import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { resolveTemplateTree } from './template-tree.js';

describe('resolveTemplateTree', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'alambic-manifest-tt-'));
    await mkdir(join(dir, 'templates'), { recursive: true });
    await mkdir(join(dir, 'sections'), { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('parses a JSON template into section types', async () => {
    await writeFile(
      join(dir, 'templates', 'index.json'),
      JSON.stringify({
        sections: {
          hero: { type: 'hero' },
          duplicate: { type: 'hero' },
          featured: { type: 'featured' },
        },
        order: ['hero', 'duplicate', 'featured'],
      }),
    );
    const out = await resolveTemplateTree({ themeDir: dir });
    expect(out).toEqual([{ handle: 'index', sectionTypes: ['hero', 'featured'] }]);
  });

  test('parses a Liquid template via {% section %} tags', async () => {
    await writeFile(
      join(dir, 'templates', 'cart.liquid'),
      `{% section 'cart-summary' %}\n{% section 'cart-footer' %}\n`,
    );
    const out = await resolveTemplateTree({ themeDir: dir });
    expect(out).toEqual([{ handle: 'cart', sectionTypes: ['cart-summary', 'cart-footer'] }]);
  });

  test('expands {% sections %} into section-group entries', async () => {
    await writeFile(
      join(dir, 'templates', 'index.liquid'),
      `{%- sections 'header-group' -%}\n{% section 'main' %}\n`,
    );
    await writeFile(
      join(dir, 'sections', 'header-group.json'),
      JSON.stringify({
        sections: {
          a: { type: 'announcement-bar' },
          b: { type: 'main-header' },
        },
      }),
    );
    const out = await resolveTemplateTree({ themeDir: dir });
    expect(out).toEqual([
      {
        handle: 'index',
        sectionTypes: ['main', 'announcement-bar', 'main-header'],
      },
    ]);
  });

  test('skips dotfiles and unknown extensions', async () => {
    await writeFile(join(dir, 'templates', '.DS_Store'), 'x');
    await writeFile(join(dir, 'templates', 'README.md'), 'x');
    await writeFile(
      join(dir, 'templates', 'index.json'),
      JSON.stringify({ sections: { x: { type: 'x' } }, order: ['x'] }),
    );
    const out = await resolveTemplateTree({ themeDir: dir });
    expect(out).toEqual([{ handle: 'index', sectionTypes: ['x'] }]);
  });

  test('returns an empty array when templates/ does not exist', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'alambic-empty-'));
    try {
      const out = await resolveTemplateTree({ themeDir: empty });
      expect(out).toEqual([]);
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });

  test('tolerates a missing section-group file silently', async () => {
    await writeFile(join(dir, 'templates', 'index.liquid'), `{% sections 'missing-group' %}\n`);
    const out = await resolveTemplateTree({ themeDir: dir });
    expect(out).toEqual([{ handle: 'index', sectionTypes: [] }]);
  });

  test('tolerates malformed JSON without throwing', async () => {
    await writeFile(join(dir, 'templates', 'broken.json'), '{not json');
    const out = await resolveTemplateTree({ themeDir: dir });
    expect(out).toEqual([{ handle: 'broken', sectionTypes: [] }]);
  });

  test('sorts templates alphabetically by handle', async () => {
    await writeFile(
      join(dir, 'templates', 'product.json'),
      JSON.stringify({ sections: { a: { type: 'a' } }, order: ['a'] }),
    );
    await writeFile(
      join(dir, 'templates', '404.json'),
      JSON.stringify({ sections: { a: { type: 'a' } }, order: ['a'] }),
    );
    await writeFile(
      join(dir, 'templates', 'index.json'),
      JSON.stringify({ sections: { a: { type: 'a' } }, order: ['a'] }),
    );
    const out = await resolveTemplateTree({ themeDir: dir });
    expect(out.map((t) => t.handle)).toEqual(['404', 'index', 'product']);
  });
});
