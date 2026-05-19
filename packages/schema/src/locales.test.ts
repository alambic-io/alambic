import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { flatten, loadLocales } from './locales.js';

async function makeTheme(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'alambic-locales-'));
  await mkdir(join(dir, 'locales'), { recursive: true });
  return dir;
}

describe('flatten', () => {
  test('flattens nested objects into dotted keys', () => {
    expect(
      flatten({
        general: { search: { placeholder: 'Search' }, sort: 'Sort' },
        cart: { empty: 'Cart is empty' },
      }),
    ).toEqual({
      'general.search.placeholder': 'Search',
      'general.sort': 'Sort',
      'cart.empty': 'Cart is empty',
    });
  });

  test('coerces non-string scalar leaves to strings', () => {
    expect(flatten({ count: 5, ok: true })).toEqual({ count: '5', ok: 'true' });
  });

  test('stringifies arrays as JSON leaves (Shopify does not traverse)', () => {
    expect(flatten({ items: ['a', 'b'] })).toEqual({ items: '["a","b"]' });
  });

  test('returns an empty object for null / undefined inputs', () => {
    expect(flatten(null)).toEqual({});
    expect(flatten(undefined)).toEqual({});
  });
});

describe('loadLocales', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await makeTheme();
  });

  test('returns empty results when there is no locales/ directory', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'alambic-no-locales-'));
    const out = await loadLocales({ themeRoot: empty });
    expect(out.entries).toEqual([]);
    expect(out.defaultLocale).toBeNull();
    expect(out.allKeys).toEqual([]);
  });

  test('discovers locale files and flags the default', async () => {
    await writeFile(
      join(dir, 'locales', 'en.default.json'),
      JSON.stringify({ cart: { empty: 'Empty' }, general: { search: { placeholder: 'Search' } } }),
    );
    await writeFile(join(dir, 'locales', 'fr.json'), JSON.stringify({ cart: { empty: 'Vide' } }));
    const out = await loadLocales({ themeRoot: dir });
    expect(out.entries.map((e) => e.locale)).toEqual(['en', 'fr']);
    expect(out.defaultLocale?.locale).toBe('en');
    expect(out.defaultLocale?.isDefault).toBe(true);
    expect(out.allKeys).toContain('cart.empty');
    expect(out.allKeys).toContain('general.search.placeholder');
  });

  test('reads schema locales separately from storefront locales', async () => {
    await writeFile(
      join(dir, 'locales', 'en.default.json'),
      JSON.stringify({ cart: { empty: 'Empty' } }),
    );
    await writeFile(
      join(dir, 'locales', 'en.default.schema.json'),
      JSON.stringify({ settings: { heading: { label: 'Heading' } } }),
    );
    const out = await loadLocales({ themeRoot: dir });
    expect(out.allKeys).toContain('cart.empty');
    expect(out.allKeys).not.toContain('settings.heading.label');
    expect(out.allSchemaKeys).toContain('settings.heading.label');
  });

  test('throws with context on a malformed locale file', async () => {
    await writeFile(join(dir, 'locales', 'en.default.json'), '{ not valid json');
    await expect(loadLocales({ themeRoot: dir })).rejects.toThrow(/Failed to parse locale/);
  });

  test('prefers en.default.json when multiple defaults exist', async () => {
    await writeFile(join(dir, 'locales', 'en.default.json'), JSON.stringify({ k: 'a' }));
    await writeFile(join(dir, 'locales', 'fr.default.json'), JSON.stringify({ k: 'b' }));
    const out = await loadLocales({ themeRoot: dir });
    expect(out.defaultLocale?.locale).toBe('en');
  });

  test('falls back to the first default when there is no `en.default`', async () => {
    await writeFile(join(dir, 'locales', 'de.default.json'), JSON.stringify({ k: 'a' }));
    await writeFile(join(dir, 'locales', 'fr.default.json'), JSON.stringify({ k: 'b' }));
    const out = await loadLocales({ themeRoot: dir });
    expect(out.defaultLocale?.locale).toBe('de');
  });

  test('skips dotfiles and non-json files in locales/', async () => {
    await writeFile(join(dir, 'locales', '.DS_Store'), 'x');
    await writeFile(join(dir, 'locales', 'README.md'), '# notes');
    await writeFile(join(dir, 'locales', 'en.default.json'), JSON.stringify({ k: 'a' }));
    const out = await loadLocales({ themeRoot: dir });
    expect(out.entries.map((e) => e.locale)).toEqual(['en']);
  });
});
