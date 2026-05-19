import { pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, test } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { buildThemeIndex, type ThemeIndex } from '../index/theme.js';
import { computeDiagnostics } from './diagnostics.js';

const FIXTURE_THEME = new URL('../../../schema/__fixtures__/sample-theme/', import.meta.url)
  .pathname;
const HERO_URI = pathToFileURL(`${FIXTURE_THEME}sections/hero/index.liquid`).href;
const BADGE_URI = pathToFileURL(`${FIXTURE_THEME}blocks/badge/index.liquid`).href;
const LAYOUT_URI = pathToFileURL(`${FIXTURE_THEME}layout/theme.liquid`).href;

function doc(uri: string, text: string): TextDocument {
  return TextDocument.create(uri, 'liquid', 1, text);
}

describe('computeDiagnostics', () => {
  let index: ThemeIndex;
  beforeEach(async () => {
    index = await buildThemeIndex(FIXTURE_THEME);
    // The fixture has no locales — synthesize one so we can exercise
    // locale-key diagnostics. The buildThemeIndex result is frozen via
    // its readonly types but the test only mutates the structure copy.
    const locales = {
      ...index.locales,
      allKeys: ['cart.empty', 'general.search.placeholder'],
      defaultLocale: {
        locale: 'en',
        isDefault: true,
        isSchema: false,
        filePath: '/fake/en.default.json',
        keys: { 'cart.empty': 'Empty', 'general.search.placeholder': 'Search' },
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: test-only mutation
    (index as any).locales = locales;
  });

  test('flags references to unknown locale keys', () => {
    const d = doc(LAYOUT_URI, `<a>{{ 'no.such.key' | t }}</a>`);
    const out = computeDiagnostics({ doc: d, index });
    expect(out).toHaveLength(1);
    expect(out[0]?.message).toMatch(/Unknown locale key "no\.such\.key"/);
    expect(out[0]?.code).toBe('alambic/unknown-locale-key');
  });

  test('accepts references to known locale keys', () => {
    const d = doc(LAYOUT_URI, `<a>{{ 'cart.empty' | t }}</a>`);
    expect(computeDiagnostics({ doc: d, index })).toEqual([]);
  });

  test('flags unknown setting ids inside a section file', () => {
    const d = doc(
      HERO_URI,
      `<h1>{{ section.settings.heading }}</h1>{{ section.settings.does_not_exist }}`,
    );
    const out = computeDiagnostics({ doc: d, index });
    expect(out).toHaveLength(1);
    expect(out[0]?.message).toMatch(/has no setting "does_not_exist"/);
    expect(out[0]?.code).toBe('alambic/unknown-setting');
  });

  test('does NOT flag setting access in files without a known schema', () => {
    const d = doc(LAYOUT_URI, `{{ section.settings.does_not_exist }}`);
    expect(computeDiagnostics({ doc: d, index })).toEqual([]);
  });

  test('flags unknown block setting ids inside a theme-block file', () => {
    const d = doc(BADGE_URI, `{{ block.settings.no_such }}`);
    const out = computeDiagnostics({ doc: d, index });
    expect(out).toHaveLength(1);
    expect(out[0]?.message).toMatch(/Block "badge" has no setting "no_such"/);
  });
});
