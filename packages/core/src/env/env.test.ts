import { afterEach, describe, expect, it } from 'vitest';
import { env, environmentToCliFlags, isEnvRef, resolveEnvironment } from './index.js';

describe('env() helper', () => {
  it('returns a sentinel that isEnvRef recognizes', () => {
    const ref = env('FOO');
    expect(isEnvRef(ref)).toBe(true);
    expect(ref.name).toBe('FOO');
    expect(ref.defaultValue).toBeUndefined();
  });

  it('carries an optional default value', () => {
    const ref = env('FOO', 'fallback');
    expect(ref.defaultValue).toBe('fallback');
  });

  it('isEnvRef rejects non-sentinels', () => {
    expect(isEnvRef('FOO')).toBe(false);
    expect(isEnvRef(null)).toBe(false);
    expect(isEnvRef({ name: 'FOO' })).toBe(false);
  });
});

describe('resolveEnvironment', () => {
  const original: Record<string, string | undefined> = {};
  const set = (k: string, v: string | undefined) => {
    if (!(k in original)) original[k] = process.env[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  };
  afterEach(() => {
    for (const [k, v] of Object.entries(original)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('returns all-undefined when input is undefined', () => {
    const r = resolveEnvironment(undefined);
    expect(r).toEqual({
      store: undefined,
      themeId: undefined,
      storePassword: undefined,
      shopifyEnvironment: undefined,
    });
  });

  it('resolves env refs against process.env', () => {
    set('STORE', 'mystore.myshopify.com');
    set('THEME', '12345');
    const r = resolveEnvironment({ store: env('STORE'), themeId: env('THEME') });
    expect(r.store).toBe('mystore.myshopify.com');
    expect(r.themeId).toBe('12345');
  });

  it('uses default value when env var is missing', () => {
    set('MISSING_VAR', undefined);
    const r = resolveEnvironment({ store: env('MISSING_VAR', 'fallback.myshopify.com') });
    expect(r.store).toBe('fallback.myshopify.com');
  });

  it('treats empty string env vars as missing (so defaults apply)', () => {
    set('EMPTY_VAR', '');
    const r = resolveEnvironment({ store: env('EMPTY_VAR', 'fallback') });
    expect(r.store).toBe('fallback');
  });

  it('passes through literal strings unchanged', () => {
    const r = resolveEnvironment({ store: 'literal.myshopify.com' });
    expect(r.store).toBe('literal.myshopify.com');
  });
});

describe('environmentToCliFlags', () => {
  it('emits flag pairs for set values, in a stable order', () => {
    const flags = environmentToCliFlags({
      store: 'x.myshopify.com',
      themeId: '12345',
      storePassword: 'hunter2',
      shopifyEnvironment: undefined,
    });
    expect(flags).toEqual([
      '--store',
      'x.myshopify.com',
      '--theme',
      '12345',
      '--store-password',
      'hunter2',
    ]);
  });

  it('omits missing values', () => {
    const flags = environmentToCliFlags({
      store: 'x.myshopify.com',
      themeId: undefined,
      storePassword: undefined,
      shopifyEnvironment: undefined,
    });
    expect(flags).toEqual(['--store', 'x.myshopify.com']);
  });

  it('passes --environment for shopify.theme.toml integration', () => {
    const flags = environmentToCliFlags({
      store: undefined,
      themeId: undefined,
      storePassword: undefined,
      shopifyEnvironment: 'preprod',
    });
    expect(flags).toEqual(['--environment', 'preprod']);
  });

  it('puts --environment first so it sets defaults, then flags override', () => {
    const flags = environmentToCliFlags({
      store: 'x.myshopify.com',
      themeId: '12345',
      storePassword: undefined,
      shopifyEnvironment: 'preprod',
    });
    expect(flags[0]).toBe('--environment');
    expect(flags[1]).toBe('preprod');
  });
});
