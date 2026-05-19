import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../env/index.js';
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
    expect(r.output).toBe('/proj/.alambic/theme');
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

  describe('environments', () => {
    const saved: Record<string, string | undefined> = {};
    const set = (k: string, v: string | undefined) => {
      if (!(k in saved)) saved[k] = process.env[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    };
    afterEach(() => {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      for (const k of Object.keys(saved)) delete saved[k];
    });

    it('no environments → activeEnvironmentName is null and env is all-undefined', () => {
      const r = resolveConfig({}, '/proj');
      expect(r.activeEnvironmentName).toBeNull();
      expect(r.activeEnvironment.store).toBeUndefined();
    });

    it('picks the default environment when no override given', () => {
      set('S', 'shop.myshopify.com');
      const r = resolveConfig(
        {
          environments: { dev: { store: env('S') } },
          defaultEnvironment: 'dev',
        },
        '/proj',
      );
      expect(r.activeEnvironmentName).toBe('dev');
      expect(r.activeEnvironment.store).toBe('shop.myshopify.com');
    });

    it('activeEnvironmentName from plugin options overrides defaultEnvironment', () => {
      set('S_PRE', 'preprod.myshopify.com');
      const r = resolveConfig(
        {
          environments: {
            dev: { store: 'dev.myshopify.com' },
            preprod: { store: env('S_PRE') },
          },
          defaultEnvironment: 'dev',
          activeEnvironmentName: 'preprod',
        } as never,
        '/proj',
      );
      expect(r.activeEnvironmentName).toBe('preprod');
      expect(r.activeEnvironment.store).toBe('preprod.myshopify.com');
    });

    it('throws on unknown environment name', () => {
      expect(() =>
        resolveConfig({ environments: { dev: {} }, defaultEnvironment: 'nope' } as never, '/proj'),
      ).toThrowError(/Unknown environment/);
    });
  });
});
