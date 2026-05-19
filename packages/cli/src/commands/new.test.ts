import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { newCommand } from './new.js';

describe('newCommand', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'alambic-new-'));
    // A minimal valid alambic.config.ts so loadConfig succeeds.
    await writeFile(join(cwd, 'alambic.config.ts'), `export default { themeRoot: './src' };\n`);
    await mkdir(join(cwd, 'src'), { recursive: true });
  });

  it('section: writes index.liquid + schema.ts under sections/<name>/', async () => {
    const result = await newCommand('section', 'product-card', { cwd });
    expect(result.kind).toBe('section');
    expect(result.written.length).toBe(2);
    expect(result.skipped).toEqual([]);

    const liquid = await readFile(
      join(cwd, 'src', 'sections', 'product-card', 'index.liquid'),
      'utf8',
    );
    expect(liquid).toContain('data-section-type="product-card"');

    const schema = await readFile(
      join(cwd, 'src', 'sections', 'product-card', 'schema.ts'),
      'utf8',
    );
    expect(schema).toContain("import { section, text } from '@alambic/schema'");
    expect(schema).toContain("name: 'Product card'");
  });

  it('section --with-client: also writes client.ts + index.css', async () => {
    const result = await newCommand('section', 'hero', { cwd, withClient: true });
    expect(result.written.length).toBe(4);
  });

  it('block: writes index.liquid + schema.ts under blocks/<name>/', async () => {
    const result = await newCommand('block', 'badge', { cwd });
    expect(result.written.length).toBe(2);
    const schema = await readFile(join(cwd, 'src', 'blocks', 'badge', 'schema.ts'), 'utf8');
    expect(schema).toContain("import { text, themeBlock } from '@alambic/schema'");
  });

  it('snippet: writes a single .liquid file', async () => {
    const result = await newCommand('snippet', 'price', { cwd });
    expect(result.written.length).toBe(1);
    const liquid = await readFile(join(cwd, 'src', 'snippets', 'price.liquid'), 'utf8');
    expect(liquid).toContain('alambic-snippet--price');
  });

  it('template: writes a single .json file under templates/', async () => {
    const result = await newCommand('template', 'index', { cwd });
    expect(result.kind).toBe('template');
    expect(result.written.length).toBe(1);
    const body = await readFile(join(cwd, 'src', 'templates', 'index.json'), 'utf8');
    const parsed = JSON.parse(body);
    expect(parsed).toEqual({ sections: {}, order: [] });
  });

  it('template: accepts digit-leading and underscore names (404, gift_card)', async () => {
    await newCommand('template', '404', { cwd });
    await newCommand('template', 'gift_card', { cwd });
    await expect(readFile(join(cwd, 'src', 'templates', '404.json'), 'utf8')).resolves.toContain(
      '"sections"',
    );
    await expect(
      readFile(join(cwd, 'src', 'templates', 'gift_card.json'), 'utf8'),
    ).resolves.toContain('"sections"');
  });

  it('template: accepts dot-suffixed variants (product.alternate)', async () => {
    const result = await newCommand('template', 'product.alternate', { cwd });
    expect(result.written.length).toBe(1);
  });

  it('template: rejects slashes and uppercase', async () => {
    await expect(newCommand('template', 'customers/account', { cwd })).rejects.toThrowError(
      /Invalid template name/,
    );
    await expect(newCommand('template', 'Index', { cwd })).rejects.toThrowError(
      /Invalid template name/,
    );
  });

  it('refuses to overwrite existing files (returns them in `skipped`)', async () => {
    await newCommand('section', 'hero', { cwd });
    const second = await newCommand('section', 'hero', { cwd });
    expect(second.written).toEqual([]);
    expect(second.skipped.length).toBe(2);
  });

  it('rejects invalid names', async () => {
    await expect(newCommand('section', 'Bad Name', { cwd })).rejects.toThrowError(/Invalid name/);
    await expect(newCommand('section', '1leading', { cwd })).rejects.toThrowError(/Invalid name/);
    await expect(newCommand('section', '', { cwd })).rejects.toThrowError(/Invalid name/);
  });
});
