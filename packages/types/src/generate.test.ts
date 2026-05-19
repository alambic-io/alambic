import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { block, number, product, range, section, select, text, themeBlock } from '@alambic/schema';
import { describe, expect, it } from 'vitest';
import { generateTypes, renderDts } from './generate.js';

describe('renderDts', () => {
  it('emits never unions when no sections/blocks exist', () => {
    const out = renderDts([], []);
    expect(out).toContain('type SectionHandle = never');
    expect(out).toContain('type BlockHandle = never');
  });

  it('emits per-setting TS types from a SectionDefinition', () => {
    const def = section({
      name: 'Hero',
      settings: [
        text({ id: 'heading', label: 'Heading' }),
        range({ id: 'padding', label: 'Padding', min: 0, max: 100, default: 40 }),
        product({ id: 'p', label: 'Product' }),
        select({
          id: 'align',
          label: 'Align',
          options: [
            { value: 'left', label: 'Left' },
            { value: 'right', label: 'Right' },
          ],
        }),
      ],
    });
    const out = renderDts([{ handle: 'hero', def }], []);
    expect(out).toContain('"hero":');
    expect(out).toContain('readonly "heading": string');
    expect(out).toContain('readonly "padding": number');
    expect(out).toContain('readonly "p": Shopify.Product | null');
    expect(out).toContain('readonly "align": "left" | "right"');
  });

  it('omits header/paragraph (no id) from generated settings', () => {
    const def = section({
      name: 'Hero',
      settings: [text({ id: 'heading', label: 'Heading' })],
    });
    const out = renderDts([{ handle: 'hero', def }], []);
    expect(out).toContain('"heading"');
    expect(out).not.toContain('header');
  });

  it('renders theme blocks with their settings under Theme.BlockMap', () => {
    const def = themeBlock({
      name: 'Badge',
      settings: [text({ id: 'text', label: 'Text' }), number({ id: 'count', label: 'Count' })],
    });
    const out = renderDts([], [{ handle: 'badge', def }]);
    expect(out).toContain('"badge":');
    expect(out).toContain('readonly "text": string');
    expect(out).toContain('readonly "count": number | null');
  });

  it('emits a typed block-array for sections with local blocks', () => {
    const def = section({
      name: 'Carousel',
      blocks: [
        block({ type: 'slide', name: 'Slide' }),
        block({ type: 'caption', name: 'Caption' }),
      ],
    });
    const out = renderDts([{ handle: 'carousel', def }], []);
    expect(out).toContain('readonly type: "slide" | "caption"');
  });
});

describe('generateTypes (integration)', () => {
  it('walks src/sections and src/blocks, writes a .d.ts file', async () => {
    // Use a fixture inside the package so jiti can resolve `@alambic/schema`
    // through pnpm's normal node_modules cascade.
    const themeRoot = new URL('../__fixtures__/sample-theme/', import.meta.url).pathname;
    const outputDir = await mkdtemp(join(tmpdir(), 'alambic-types-out-'));

    const result = await generateTypes({ themeRoot, outputDir });
    expect(result.sectionCount).toBe(1);
    expect(result.blockCount).toBe(1);

    const content = await readFile(result.outputFile, 'utf8');
    expect(content).toContain('"hero"');
    expect(content).toContain('"badge"');
    expect(content).toContain('readonly "heading": string');
    expect(content).toContain('readonly "text": string');
  });
});
