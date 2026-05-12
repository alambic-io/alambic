import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { discoverEntries } from './entries.js';

describe('discoverEntries', () => {
  let themeRoot: string;

  beforeAll(async () => {
    themeRoot = await mkdtemp(join(tmpdir(), 'alambic-entries-'));
    await mkdir(join(themeRoot, 'sections', 'product-card'), { recursive: true });
    await mkdir(join(themeRoot, 'sections', 'hero'), { recursive: true });
    await mkdir(join(themeRoot, 'snippets'), { recursive: true });
    await mkdir(join(themeRoot, 'layout'), { recursive: true });
    await mkdir(join(themeRoot, 'config'), { recursive: true });

    await writeFile(join(themeRoot, 'sections', 'product-card', 'client.ts'), '');
    await writeFile(join(themeRoot, 'sections', 'product-card', 'index.css'), '');
    await writeFile(join(themeRoot, 'sections', 'product-card', 'index.liquid'), '');
    await writeFile(join(themeRoot, 'sections', 'hero', 'client.ts'), '');
    await writeFile(join(themeRoot, 'snippets', 'badge.ts'), '');
    await writeFile(join(themeRoot, 'layout', 'theme.ts'), '');
    await writeFile(join(themeRoot, 'config', 'settings_data.json'), '{}');
  });

  afterAll(async () => {
    // best-effort cleanup; OS will reap the tmpdir
  });

  it('picks up section client and css, snippets, layout entries', async () => {
    const entries = await discoverEntries({ themeRoot });
    const ids = entries.map((e) => e.id).sort();
    expect(ids).toEqual([
      'layout/theme',
      'sections/hero/client',
      'sections/product-card/client',
      'sections/product-card/index',
      'snippets/badge',
    ]);
  });

  it('classifies kinds', async () => {
    const entries = await discoverEntries({ themeRoot });
    const byKind = entries.reduce<Record<string, number>>((acc, e) => {
      const k = e.kind ?? 'other';
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
    expect(byKind['section']).toBe(3);
    expect(byKind['snippet']).toBe(1);
    expect(byKind['layout']).toBe(1);
  });

  it('skips liquid and config files', async () => {
    const entries = await discoverEntries({ themeRoot });
    expect(entries.some((e) => e.id.endsWith('.liquid'))).toBe(false);
    expect(entries.some((e) => e.id.startsWith('config/'))).toBe(false);
  });
});
