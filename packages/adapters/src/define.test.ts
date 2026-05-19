import { describe, expect, it } from 'vitest';
import { noopPreset } from '../__fixtures__/noop-adapter.js';
import { defineCssAdapter, defineJsAdapter, definePreset } from './define.js';

describe('define helpers', () => {
  it('return their input unchanged (identity)', () => {
    const css = defineCssAdapter({
      name: 'x',
      vitePlugins: () => [],
      contentSources: () => [],
      emitTokens: () => '',
      extractCritical: () => '',
    });
    expect(css.name).toBe('x');

    const js = defineJsAdapter({
      name: 'y',
      vitePlugins: () => [],
      discoverEntries: () => [],
      hydrationRuntime: '/runtime.js',
      generateComponentBindings: () => '',
    });
    expect(js.hydrationRuntime).toBe('/runtime.js');

    const preset = definePreset({ name: 'z', css, js });
    expect(preset.css).toBe(css);
    expect(preset.js).toBe(js);
  });
});

describe('noop fixture preset', () => {
  it('implements every contract method', () => {
    expect(noopPreset.name).toBe('noop');
    expect(noopPreset.css.name).toBe('noop-css');
    expect(noopPreset.js.name).toBe('noop-js');

    const ctx = {
      mode: 'dev' as const,
      themeRoot: '/tmp/theme',
      outputRoot: '/tmp/dist',
      sections: [],
      settings: {},
      logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
    };

    expect(noopPreset.css.vitePlugins(ctx)).toEqual([]);
    expect(noopPreset.css.contentSources(ctx)).toEqual([]);
    expect(noopPreset.css.emitTokens({})).toBe('');
    expect(noopPreset.css.extractCritical('<html/>', '')).toBe('');

    expect(noopPreset.js.discoverEntries(ctx)).toEqual([]);
    expect(noopPreset.js.hydrationRuntime).toBe('');
    expect(
      noopPreset.js.generateComponentBindings({
        handle: 'product-card',
        sourcePath: '/tmp/theme/sections/product-card/index.liquid',
      }),
    ).toBe('');
  });
});
