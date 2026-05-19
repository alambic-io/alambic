import { describe, expect, test } from 'vitest';
import { buildAssetGraph } from './asset-graph.js';

describe('buildAssetGraph', () => {
  test('maps templates to their section chunks and totals their bytes', () => {
    const out = buildAssetGraph({
      templates: [
        { handle: 'index', sectionTypes: ['hero', 'featured'] },
        { handle: '404', sectionTypes: ['hero'] },
      ],
      sectionChunks: {
        // hero has no client.ts → no chunk
        featured: 'sections-featured-client-abc.js',
      },
      assetBytes: {
        'sections-featured-client-abc.js': 1024,
        'theme.css': 8192,
        'alambic-runtime-x.js': 2560,
        'layout-theme-y.js': 46080,
      },
      sharedCss: ['theme.css'],
      sharedJs: ['alambic-runtime-x.js', 'layout-theme-y.js'],
    });

    const index = out.templates['index'];
    const fourOhFour = out.templates['404'];
    expect(index).toBeDefined();
    expect(fourOhFour).toBeDefined();

    expect(index?.sectionChunks).toEqual(['sections-featured-client-abc.js']);
    expect(index?.cssFiles).toEqual(['theme.css']);
    expect(index?.cssBytes).toBe(8192);
    expect(index?.jsBytes).toBe(2560 + 46080 + 1024);

    expect(fourOhFour?.sectionChunks).toEqual([]);
    expect(fourOhFour?.jsBytes).toBe(2560 + 46080);
  });

  test('treats missing sizes as zero (no crash on incomplete bundle data)', () => {
    const out = buildAssetGraph({
      templates: [{ handle: 'index', sectionTypes: ['x'] }],
      sectionChunks: { x: 'x-chunk.js' },
      assetBytes: {},
      sharedJs: ['shared.js'],
    });
    expect(out.templates['index']?.jsBytes).toBe(0);
  });

  test('ignores section types that have no chunk', () => {
    const out = buildAssetGraph({
      templates: [{ handle: 'index', sectionTypes: ['hero', 'missing'] }],
      sectionChunks: { hero: 'h.js' },
      assetBytes: { 'h.js': 100 },
    });
    expect(out.templates['index']?.sectionChunks).toEqual(['h.js']);
    expect(out.templates['index']?.jsBytes).toBe(100);
  });
});
