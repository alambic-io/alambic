import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { discoverSchemas } from './discover.js';

describe('discoverSchemas', () => {
  test('walks sections/*/schema.ts and blocks/*/schema.ts in a real theme', async () => {
    const themeRoot = new URL('../__fixtures__/sample-theme/', import.meta.url).pathname;
    const out = await discoverSchemas({ themeRoot });

    expect(out.sections.map((s) => s.handle)).toEqual(['featured', 'hero']);
    expect(out.blocks.map((b) => b.handle)).toEqual(['badge']);

    const hero = out.sections.find((s) => s.handle === 'hero');
    expect(hero?.definition.kind).toBe('section');
    expect(hero?.definition.name).toBe('Hero');
    expect(hero?.filePath.endsWith('sections/hero/schema.ts')).toBe(true);

    const badge = out.blocks[0];
    expect(badge?.definition.kind).toBe('theme-block');
    expect(badge?.definition.name).toBe('Badge');
  });

  test('returns empty arrays when the theme has no schemas', async () => {
    const themeRoot = await mkdtemp(join(tmpdir(), 'alambic-discover-empty-'));
    const out = await discoverSchemas({ themeRoot });
    expect(out.sections).toEqual([]);
    expect(out.blocks).toEqual([]);
  });

  test('skips folders that contain a schema.ts without a default export', async () => {
    const themeRoot = await mkdtemp(join(tmpdir(), 'alambic-discover-bad-'));
    await mkdir(join(themeRoot, 'sections', 'broken'), { recursive: true });
    await writeFile(
      join(themeRoot, 'sections', 'broken', 'schema.ts'),
      `export const not_a_default = 42;\n`,
    );
    const out = await discoverSchemas({ themeRoot });
    expect(out.sections).toEqual([]);
  });

  test('returns sections sorted alphabetically by handle', async () => {
    const themeRoot = new URL('../__fixtures__/sample-theme/', import.meta.url).pathname;
    const out = await discoverSchemas({ themeRoot });
    const handles = out.sections.map((s) => s.handle);
    expect(handles).toEqual([...handles].sort());
  });

  test('throws with context when a schema.ts fails to import', async () => {
    const themeRoot = await mkdtemp(join(tmpdir(), 'alambic-discover-throw-'));
    await mkdir(join(themeRoot, 'sections', 'syntax-error'), { recursive: true });
    await writeFile(
      join(themeRoot, 'sections', 'syntax-error', 'schema.ts'),
      `export default { kind: 'section' ;\n`, // intentional syntax error
    );
    await expect(discoverSchemas({ themeRoot })).rejects.toThrow(/Failed to import schema/);
  });
});
