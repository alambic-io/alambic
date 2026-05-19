import { pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, test } from 'vitest';
import { buildThemeIndex, type ThemeIndex } from '../index/theme.js';
import { computeCompletions } from './completion.js';

const FIXTURE_THEME = new URL('../../../schema/__fixtures__/sample-theme/', import.meta.url)
  .pathname;
const HERO_URI = pathToFileURL(`${FIXTURE_THEME}sections/hero/index.liquid`).href;
const BADGE_URI = pathToFileURL(`${FIXTURE_THEME}blocks/badge/index.liquid`).href;
const LAYOUT_URI = pathToFileURL(`${FIXTURE_THEME}layout/theme.liquid`).href;

describe('computeCompletions', () => {
  let index: ThemeIndex;
  beforeEach(async () => {
    index = await buildThemeIndex(FIXTURE_THEME);
  });

  test("section.settings.<X> in a section file lists that section's settings", () => {
    const text = `{{ section.settings.`;
    const out = computeCompletions({
      uri: HERO_URI,
      text,
      offset: text.length,
      index,
    });
    expect(out.map((c) => c.label)).toContain('heading');
  });

  test('section.settings completion is empty when the file is not a section', () => {
    const text = `{{ section.settings.`;
    const out = computeCompletions({
      uri: LAYOUT_URI,
      text,
      offset: text.length,
      index,
    });
    expect(out).toEqual([]);
  });

  test("block.settings.<X> inside a theme-block file lists that block's settings", () => {
    const text = `{{ block.settings.`;
    const out = computeCompletions({
      uri: BADGE_URI,
      text,
      offset: text.length,
      index,
    });
    expect(out.map((c) => c.label)).toContain('label');
  });

  test('block.settings completion is empty when not inside a theme block', () => {
    const text = `{{ block.settings.`;
    const out = computeCompletions({
      uri: HERO_URI,
      text,
      offset: text.length,
      index,
    });
    expect(out).toEqual([]);
  });

  test('section-tag completion lists every section handle in the theme', () => {
    const text = `{% section '`;
    const out = computeCompletions({
      uri: LAYOUT_URI,
      text,
      offset: text.length,
      index,
    });
    const labels = out.map((c) => c.label);
    expect(labels).toContain('hero');
    expect(labels).toContain('featured');
  });

  test('returns no completions in plain HTML context', () => {
    const text = `<p>hello</p>`;
    expect(computeCompletions({ uri: HERO_URI, text, offset: text.length, index })).toEqual([]);
  });
});
