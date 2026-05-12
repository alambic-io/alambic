import { describe, expect, it } from 'vitest';
import { AlambicError } from '../errors/index.js';
import { defineConfig, resolveConfig } from './index.js';

describe('defineConfig', () => {
  it('is an identity function', () => {
    const c = { themeRoot: './src' };
    expect(defineConfig(c)).toBe(c);
  });
});

describe('resolveConfig', () => {
  it('applies defaults', () => {
    const r = resolveConfig({}, '/proj');
    expect(r.themeRoot).toBe('/proj/src');
    expect(r.output).toBe('/proj/dist/theme');
    expect(r.dev.vitePort).toBe(5173);
    expect(r.dev.shopifyPort).toBe(9292);
    expect(r.dev.spawnShopifyCli).toBe(true);
  });

  it('resolves relative paths against cwd', () => {
    const r = resolveConfig({ themeRoot: 'theme', output: 'out' }, '/proj');
    expect(r.themeRoot).toBe('/proj/theme');
    expect(r.output).toBe('/proj/out');
  });

  it('rejects both preset and css/js', () => {
    const preset = {
      name: 'p',
      css: { name: 'c' } as never,
      js: { name: 'j' } as never,
    };
    expect(() => resolveConfig({ preset, css: { name: 'x' } as never }, '/proj')).toThrowError(
      AlambicError,
    );
  });

  it('lifts css+js out of preset when present', () => {
    const css = { name: 'c' } as never;
    const js = { name: 'j' } as never;
    const preset = { name: 'p', css, js };
    const r = resolveConfig({ preset }, '/proj');
    expect(r.preset).toBe(preset);
    expect(r.css).toBe(css);
    expect(r.js).toBe(js);
  });
});
