import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cssAdapterCases, jsAdapterCases, makeStubContext } from '@alambic/adapters/conformance';
import { describe, expect, it, test } from 'vitest';
import { alpine, alpineEntries, tailwindAlpine, tailwindCss } from './index.js';

describe('tailwindAlpine preset', () => {
  it('returns a preset bundling Tailwind CSS + Alpine JS adapters', () => {
    const preset = tailwindAlpine();
    expect(preset.name).toBe('tailwind-alpine');
    expect(preset.css.name).toBe('tailwind-v4');
    expect(preset.js.name).toBe('alpine');
  });

  it('accepts user options without throwing', () => {
    const preset = tailwindAlpine({
      tailwind: { content: ['extra/**/*.html'] },
      alpine: { plugins: ['intersect', 'persist'] },
    });
    expect(preset).toBeDefined();
  });
});

describe('tailwindCss adapter', () => {
  it('exposes default content sources', () => {
    const css = tailwindCss();
    const ctx = {
      mode: 'dev' as const,
      themeRoot: '/x',
      outputRoot: '/y',
      sections: [],
      settings: {},
      logger: { error() {}, warn() {}, info() {}, debug() {} },
    };
    const sources = css.contentSources(ctx);
    expect(sources).toContain('**/*.liquid');
    expect(sources).toContain('**/*.{ts,tsx,js,jsx}');
  });

  it('appends user-provided content patterns', () => {
    const css = tailwindCss({ content: ['custom/**/*.svelte'] });
    const ctx = {
      mode: 'build' as const,
      themeRoot: '/x',
      outputRoot: '/y',
      sections: [],
      settings: {},
      logger: { error() {}, warn() {}, info() {}, debug() {} },
    };
    expect(css.contentSources(ctx)).toContain('custom/**/*.svelte');
  });

  it('stubs token + critical CSS in Phase 1', () => {
    const css = tailwindCss();
    expect(css.emitTokens({})).toBe('');
    expect(css.extractCritical('<html/>', '')).toBe('');
  });
});

describe('alpine adapter', () => {
  it('returns a JsAdapter with a non-empty hydration runtime path', () => {
    const js = alpine();
    expect(js.name).toBe('alpine');
    expect(typeof js.hydrationRuntime).toBe('string');
    expect(js.hydrationRuntime.length).toBeGreaterThan(0);
  });
});

describe('alpineEntries', () => {
  it('discovers sections/* /client.{ts,js,tsx} entries', async () => {
    const themeRoot = await mkdtemp(join(tmpdir(), 'alambic-preset-'));
    await mkdir(join(themeRoot, 'sections', 'product-card'), { recursive: true });
    await mkdir(join(themeRoot, 'sections', 'hero'), { recursive: true });
    await writeFile(join(themeRoot, 'sections', 'product-card', 'client.ts'), '');
    await writeFile(join(themeRoot, 'sections', 'hero', 'client.js'), '');

    const entries = await alpineEntries(themeRoot);
    expect(entries.map((e) => e.id).sort()).toEqual([
      'sections/hero/client',
      'sections/product-card/client',
    ]);
    expect(entries.every((e) => e.kind === 'section')).toBe(true);
  });
});

// The adapter conformance suite is the contract test. Every preset must
// pass it; failures here mean a regression in the contract or in the
// preset's structural compliance.
describe('tailwindAlpine — adapter conformance', () => {
  const preset = tailwindAlpine();
  const ctx = makeStubContext();
  for (const c of cssAdapterCases) {
    test(`css / ${c.name}`, async () => {
      await c.run(preset.css, ctx);
    });
  }
  for (const c of jsAdapterCases) {
    test(`js / ${c.name}`, async () => {
      await c.run(preset.js, ctx);
    });
  }
});
