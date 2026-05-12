import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { copyTheme } from './copy-theme.js';

describe('copyTheme', () => {
  let themeRoot: string;
  let output: string;

  beforeEach(async () => {
    themeRoot = await mkdtemp(join(tmpdir(), 'alambic-copy-theme-'));
    output = await mkdtemp(join(tmpdir(), 'alambic-copy-out-'));

    for (const sub of ['sections', 'snippets', 'templates', 'config', 'locales', 'layout']) {
      await mkdir(join(themeRoot, sub), { recursive: true });
    }
    await mkdir(join(themeRoot, 'sections', 'product-card'), { recursive: true });
    await mkdir(join(themeRoot, 'assets'), { recursive: true });

    await writeFile(join(themeRoot, 'sections', 'product-card', 'index.liquid'), '<h1>{{x}}</h1>');
    await writeFile(join(themeRoot, 'sections', 'product-card', 'client.ts'), 'export {}');
    await writeFile(join(themeRoot, 'sections', 'product-card', 'index.css'), 'h1{color:red}');
    await writeFile(join(themeRoot, 'snippets', 'badge.liquid'), '<span></span>');
    await writeFile(join(themeRoot, 'snippets', 'alambic-asset.liquid'), 'stale');
    await writeFile(join(themeRoot, 'templates', 'index.json'), '{}');
    await writeFile(join(themeRoot, 'config', 'settings_schema.json'), '[]');
    await writeFile(join(themeRoot, 'locales', 'en.default.json'), '{}');
    await writeFile(join(themeRoot, 'layout', 'theme.liquid'), '<!doctype html>');
    await writeFile(join(themeRoot, 'assets', 'precomputed.png'), 'binary');
  });

  it('copies liquid + json files from theme directories', async () => {
    const copied = await copyTheme({ themeRoot, output });
    expect(copied).toContain('sections/product-card/index.liquid');
    expect(copied).toContain('snippets/badge.liquid');
    expect(copied).toContain('templates/index.json');
    expect(copied).toContain('config/settings_schema.json');
    expect(copied).toContain('locales/en.default.json');
    expect(copied).toContain('layout/theme.liquid');
  });

  it('skips TS/CSS source files', async () => {
    const copied = await copyTheme({ themeRoot, output });
    expect(copied.some((p) => p.endsWith('.ts'))).toBe(false);
    expect(copied.some((p) => p.endsWith('.css'))).toBe(false);
  });

  it('skips Vite-managed assets/ directory', async () => {
    const copied = await copyTheme({ themeRoot, output });
    expect(copied.some((p) => p.startsWith('assets/'))).toBe(false);
  });

  it('skips the generated alambic-asset.liquid snippet', async () => {
    const copied = await copyTheme({ themeRoot, output });
    expect(copied).not.toContain('snippets/alambic-asset.liquid');
  });

  it('produces a readable copy at the destination', async () => {
    await copyTheme({ themeRoot, output });
    const content = await readFile(
      join(output, 'sections', 'product-card', 'index.liquid'),
      'utf8',
    );
    expect(content).toBe('<h1>{{x}}</h1>');
  });
});
