import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { buildThemeIndex } from './theme.js';

async function makeTheme(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'alambic-lsp-theme-'));
}

describe('buildThemeIndex', () => {
  let themeRoot: string;
  beforeEach(async () => {
    themeRoot = await makeTheme();
  });

  test('returns an empty index when the theme root does not exist', async () => {
    const idx = await buildThemeIndex(`${themeRoot}/missing`);
    expect(idx.sections.size).toBe(0);
    expect(idx.blocks.size).toBe(0);
    expect(idx.snippets).toEqual([]);
    expect(idx.locales.allKeys).toEqual([]);
  });

  test('indexes sections, blocks, snippets, and locale keys', async () => {
    // Use the schema package's sample-theme fixture for the schema parts
    // (jiti resolves `@alambic/schema` against this monorepo's node_modules).
    // The snippets + locales we add to a sibling temp dir below.
    const fixture = new URL('../../../schema/__fixtures__/sample-theme/', import.meta.url).pathname;

    const idx = await buildThemeIndex(fixture);
    expect(idx.sections.get('hero')?.definition.name).toBe('Hero');
    expect(idx.sections.get('featured')?.definition.name).toBe('Featured');
    expect(idx.blocks.get('badge')?.definition.name).toBe('Badge');
  });

  test('reads locale keys + snippet names from a fresh theme dir', async () => {
    await mkdir(join(themeRoot, 'snippets'), { recursive: true });
    await writeFile(join(themeRoot, 'snippets', 'price.liquid'), '<span></span>');
    await writeFile(join(themeRoot, 'snippets', 'badge.liquid'), '<span></span>');
    await mkdir(join(themeRoot, 'locales'), { recursive: true });
    await writeFile(
      join(themeRoot, 'locales', 'en.default.json'),
      JSON.stringify({ cart: { empty: 'Empty' }, general: { search: 'Search' } }),
    );

    const idx = await buildThemeIndex(themeRoot);
    expect(idx.snippets).toEqual(['badge', 'price']);
    expect(idx.locales.allKeys).toContain('cart.empty');
    expect(idx.locales.defaultLocale?.locale).toBe('en');
  });

  test('captures schema-import errors on the errors map without throwing', async () => {
    await mkdir(join(themeRoot, 'sections', 'broken'), { recursive: true });
    await writeFile(
      join(themeRoot, 'sections', 'broken', 'schema.ts'),
      `export default { kind: 'section' ;\n`, // syntax error
    );
    const idx = await buildThemeIndex(themeRoot);
    expect(idx.sections.size).toBe(0);
    expect(idx.errors.size).toBeGreaterThan(0);
  });
});
