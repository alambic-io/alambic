import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildStaging } from './build.js';

describe('buildStaging', () => {
  let themeRoot: string;
  let output: string;

  beforeEach(async () => {
    themeRoot = await mkdtemp(join(tmpdir(), 'alambic-staging-src-'));
    output = await mkdtemp(join(tmpdir(), 'alambic-staging-out-'));

    // Nested section folder with co-located ts/css.
    await mkdir(join(themeRoot, 'sections', 'hero'), { recursive: true });
    await writeFile(join(themeRoot, 'sections', 'hero', 'index.liquid'), '<h1>hero</h1>');
    await writeFile(join(themeRoot, 'sections', 'hero', 'client.ts'), 'export {}');
    await writeFile(join(themeRoot, 'sections', 'hero', 'index.css'), 'h1 { color: red }');

    // Flat section alongside the nested one.
    await writeFile(join(themeRoot, 'sections', 'banner.liquid'), '<aside>banner</aside>');

    // Standard theme dirs.
    await mkdir(join(themeRoot, 'snippets'), { recursive: true });
    await writeFile(join(themeRoot, 'snippets', 'badge.liquid'), '<span></span>');

    await mkdir(join(themeRoot, 'templates'), { recursive: true });
    await writeFile(join(themeRoot, 'templates', 'index.json'), '{}');

    await mkdir(join(themeRoot, 'config'), { recursive: true });
    await writeFile(join(themeRoot, 'config', 'settings_schema.json'), '[]');

    await mkdir(join(themeRoot, 'layout'), { recursive: true });
    await writeFile(join(themeRoot, 'layout', 'theme.liquid'), '<!doctype html>');
    await writeFile(join(themeRoot, 'layout', 'theme.ts'), 'export {}');
    await writeFile(join(themeRoot, 'layout', 'theme.css'), '*{box-sizing:border-box}');

    // Non-theme noise that should be skipped.
    await writeFile(join(themeRoot, 'package.json'), '{}');
    await writeFile(join(themeRoot, 'README.md'), '# theme');
  });

  it('flattens nested sections', async () => {
    const written = await buildStaging({ themeRoot, output });
    expect(written).toContain('sections/hero.liquid');
    expect(written).not.toContain('sections/hero/index.liquid');

    const content = await readFile(join(output, 'sections', 'hero.liquid'), 'utf8');
    expect(content).toBe('<h1>hero</h1>');
  });

  it('preserves flat sections alongside the flattened nested one', async () => {
    const written = await buildStaging({ themeRoot, output });
    expect(written).toContain('sections/banner.liquid');
  });

  it('passes through snippets, templates, config, layout liquid', async () => {
    const written = await buildStaging({ themeRoot, output });
    expect(written).toContain('snippets/badge.liquid');
    expect(written).toContain('templates/index.json');
    expect(written).toContain('config/settings_schema.json');
    expect(written).toContain('layout/theme.liquid');
  });

  it('skips TS/CSS files (Vite handles them)', async () => {
    const written = await buildStaging({ themeRoot, output });
    expect(written.some((p) => p.endsWith('.ts'))).toBe(false);
    expect(written.some((p) => p.endsWith('.css'))).toBe(false);
  });

  it('skips files outside known theme directories', async () => {
    const written = await buildStaging({ themeRoot, output });
    expect(written).not.toContain('package.json');
    expect(written).not.toContain('README.md');
  });

  it('copies a root-level .shopifyignore into the staging dir', async () => {
    await writeFile(join(themeRoot, '.shopifyignore'), 'templates/*.json\n');
    const written = await buildStaging({ themeRoot, output });
    expect(written).toContain('.shopifyignore');
    const content = await readFile(join(output, '.shopifyignore'), 'utf8');
    expect(content).toBe('templates/*.json\n');
  });

  it('cleans output by default', async () => {
    await buildStaging({ themeRoot, output });
    // Add a stale file directly in output (e.g., left over from previous build).
    await writeFile(join(output, 'snippets', 'stale.liquid'), 'old');
    const second = await buildStaging({ themeRoot, output });
    expect(second).not.toContain('snippets/stale.liquid');
  });

  it('preserves existing output when clean=false', async () => {
    await buildStaging({ themeRoot, output });
    await writeFile(join(output, 'snippets', 'kept.liquid'), 'kept');
    await buildStaging({ themeRoot, output, clean: false });
    const content = await readFile(join(output, 'snippets', 'kept.liquid'), 'utf8');
    expect(content).toBe('kept');
  });
});
