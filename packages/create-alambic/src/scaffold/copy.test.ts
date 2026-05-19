import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { copyTemplate } from './copy.js';

describe('copyTemplate', () => {
  it('copies a directory tree and substitutes tokens in text files', async () => {
    const src = await mkdtemp(join(tmpdir(), 'create-alambic-src-'));
    const dest = await mkdtemp(join(tmpdir(), 'create-alambic-dest-'));

    await mkdir(join(src, 'src', 'sections'), { recursive: true });
    await writeFile(
      join(src, 'package.json'),
      JSON.stringify({ name: '{{PROJECT_NAME}}', version: '0.0.0' }, null, 2),
    );
    await writeFile(join(src, 'src', 'sections', 'hero.liquid'), '<h1>{{PROJECT_NAME}}</h1>');

    const written = await copyTemplate(src, dest, { PROJECT_NAME: 'my-theme' });

    expect(written).toContain('package.json');
    expect(written).toContain('src/sections/hero.liquid');

    const pkg = JSON.parse(await readFile(join(dest, 'package.json'), 'utf8')) as { name: string };
    expect(pkg.name).toBe('my-theme');

    const hero = await readFile(join(dest, 'src', 'sections', 'hero.liquid'), 'utf8');
    expect(hero).toBe('<h1>my-theme</h1>');
  });
});
