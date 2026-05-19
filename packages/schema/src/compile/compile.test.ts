import { describe, expect, it } from 'vitest';
import { block } from '../builders/block.js';
import { section, themeBlock } from '../builders/section.js';
import {
  article,
  article_list,
  blog,
  checkbox,
  collection,
  collection_list,
  color,
  color_background,
  color_scheme,
  color_scheme_group,
  font_picker,
  header,
  html,
  image_picker,
  inline_richtext,
  link_list,
  liquid,
  metaobject,
  metaobject_list,
  number,
  page,
  paragraph,
  product,
  product_list,
  radio,
  range,
  richtext,
  select,
  text,
  text_alignment,
  textarea,
  url,
  video,
  video_url,
} from '../builders/settings.js';
import { compileSection, compileThemeBlock, stringifySchema } from './compile.js';

describe('compileSection — minimal', () => {
  it('emits just `name` when nothing else is configured', () => {
    const out = compileSection(section({ name: 'Hero' }));
    expect(out).toEqual({ name: 'Hero' });
  });
});

describe('compileSection — top-level fields', () => {
  it('preserves every documented top-level field', () => {
    const def = section({
      name: 'Hero',
      tag: 'section',
      class: 'hero',
      limit: 2,
      max_blocks: 10,
      settings: [text({ id: 'heading', label: 'Heading' })],
      presets: [{ name: 'Hero', category: 'Marketing' }],
      enabled_on: { templates: ['index'] },
      disabled_on: { templates: ['cart'] },
      default: { settings: { heading: 'hi' } },
      locales: { en: { 'foo.bar': 'Foo' } },
      templates: ['index', 'product'],
    });
    const out = compileSection(def);
    expect(out['name']).toBe('Hero');
    expect(out['tag']).toBe('section');
    expect(out['class']).toBe('hero');
    expect(out['limit']).toBe(2);
    expect(out['max_blocks']).toBe(10);
    expect(out['presets']).toEqual([{ name: 'Hero', category: 'Marketing' }]);
    expect(out['enabled_on']).toEqual({ templates: ['index'] });
    expect(out['disabled_on']).toEqual({ templates: ['cart'] });
    expect(out['default']).toEqual({ settings: { heading: 'hi' } });
    expect(out['locales']).toEqual({ en: { 'foo.bar': 'Foo' } });
    expect(out['templates']).toEqual(['index', 'product']);
  });

  it('omits empty arrays + undefined fields', () => {
    const out = compileSection(section({ name: 'Hero', settings: [], blocks: [] }));
    expect(out).toEqual({ name: 'Hero' });
  });
});

describe('compileSection — every setting type round-trips', () => {
  it('strips `kind` and emits Shopify JSON for all 30+ setting types', () => {
    const def = section({
      name: 'Kitchen Sink',
      settings: [
        text({ id: 't', label: 'Text', default: 'hi', placeholder: 'type…', info: '' }),
        textarea({ id: 'ta', label: 'Textarea' }),
        number({ id: 'n', label: 'Number', default: 4 }),
        checkbox({ id: 'cb', label: 'Check', default: true }),
        range({ id: 'r', label: 'Range', min: 0, max: 10, step: 1, unit: 'px', default: 4 }),
        select({
          id: 's',
          label: 'Select',
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B', group: 'g' },
          ],
          default: 'a',
        }),
        radio({
          id: 'ra',
          label: 'Radio',
          options: [
            { value: 'x', label: 'X' },
            { value: 'y', label: 'Y' },
          ],
        }),
        richtext({ id: 'rt', label: 'Rich' }),
        inline_richtext({ id: 'irt', label: 'Inline rich' }),
        html({ id: 'h', label: 'HTML' }),
        liquid({ id: 'lq', label: 'Liquid' }),
        image_picker({ id: 'img', label: 'Image' }),
        video({ id: 'v', label: 'Video' }),
        video_url({ id: 'vu', label: 'Video URL', accept: ['youtube', 'vimeo'] }),
        article({ id: 'art', label: 'Article' }),
        article_list({ id: 'arts', label: 'Articles', limit: 5 }),
        blog({ id: 'bl', label: 'Blog' }),
        collection({ id: 'col', label: 'Collection' }),
        collection_list({ id: 'cols', label: 'Collections' }),
        page({ id: 'pg', label: 'Page' }),
        product({ id: 'p', label: 'Product' }),
        product_list({ id: 'ps', label: 'Products', limit: 12 }),
        link_list({ id: 'menu', label: 'Menu', default: 'main-menu' }),
        url({ id: 'u', label: 'URL', default: '/collections' }),
        metaobject({ id: 'mo', label: 'Metaobject', metaobject_type: 'app.author' }),
        metaobject_list({ id: 'mol', label: 'Authors', metaobject_type: 'app.author', limit: 50 }),
        color({ id: 'c', label: 'Color', default: '#000000' }),
        color_background({ id: 'cb2', label: 'Background', default: 'linear-gradient(...)' }),
        color_scheme({ id: 'cs', label: 'Color scheme', default: 'scheme-1' }),
        color_scheme_group({
          id: 'csg',
          definition: [color({ id: 'background', label: 'BG' })],
          role: { background: 'background' },
        }),
        font_picker({ id: 'fp', label: 'Font', default: 'helvetica_n4' }),
        text_alignment({ id: 'al', label: 'Align', default: 'center' }),
        header({ content: 'Section header' }),
        paragraph({ content: 'Helper text.' }),
      ],
    });
    const out = compileSection(def);
    // None of the emitted settings should retain a `kind` field.
    const settings = out['settings'] as Array<Record<string, unknown>>;
    expect(settings.every((s) => !('kind' in s))).toBe(true);
    // Every documented Shopify type appears exactly once.
    const types = settings.map((s) => s['type'] as string);
    expect(new Set(types).size).toBe(types.length);
    expect(types).toMatchSnapshot();
  });
});

describe('compileSection — blocks', () => {
  it('emits local blocks with type/name/settings', () => {
    const def = section({
      name: 'Carousel',
      blocks: [
        block({
          type: 'slide',
          name: 'Slide',
          limit: 5,
          settings: [text({ id: 'caption', label: 'Caption' })],
        }),
      ],
    });
    const out = compileSection(def);
    expect(out['blocks']).toEqual([
      {
        type: 'slide',
        name: 'Slide',
        limit: 5,
        settings: [{ type: 'text', id: 'caption', label: 'Caption' }],
      },
    ]);
  });

  it('emits @theme and @app references as plain `{ type }` objects', () => {
    const def = section({
      name: 'Group',
      blocks: [block.theme(), block.app()],
    });
    const out = compileSection(def);
    expect(out['blocks']).toEqual([{ type: '@theme' }, { type: '@app' }]);
  });

  it('emits named theme block references (e.g. `blocks/badge.liquid`)', () => {
    const def = section({
      name: 'Group',
      blocks: [block.named('badge'), block.named('slide')],
    });
    const out = compileSection(def);
    expect(out['blocks']).toEqual([{ type: 'badge' }, { type: 'slide' }]);
  });
});

describe('compileThemeBlock', () => {
  it('emits a theme-block schema with nested blocks (@theme)', () => {
    const def = themeBlock({
      name: 'Group',
      tag: 'div',
      settings: [text({ id: 'heading', label: 'Heading' })],
      blocks: [block.theme()],
    });
    const out = compileThemeBlock(def);
    expect(out).toEqual({
      name: 'Group',
      tag: 'div',
      settings: [{ type: 'text', id: 'heading', label: 'Heading' }],
      blocks: [{ type: '@theme' }],
    });
  });
});

describe('stringifySchema', () => {
  it('produces stable 2-space indented JSON with trailing newline', () => {
    const out = stringifySchema(compileSection(section({ name: 'Hero' })));
    expect(out).toBe('{\n  "name": "Hero"\n}\n');
  });

  it('is deterministic across runs (same input → same output)', () => {
    const def = section({
      name: 'Hero',
      settings: [text({ id: 'heading', label: 'Heading' })],
    });
    const a = stringifySchema(compileSection(def));
    const b = stringifySchema(compileSection(def));
    expect(a).toBe(b);
  });
});
