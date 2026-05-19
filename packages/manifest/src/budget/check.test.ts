import { describe, expect, test } from 'vitest';
import type { BuildManifest } from '../types.js';
import { checkBudgets } from './check.js';

const tpl = (handle: string, jsBytes: number, cssBytes: number) => ({
  template: handle,
  sections: [],
  sectionChunks: [],
  cssFiles: [],
  jsBytes,
  cssBytes,
});

describe('checkBudgets', () => {
  test('reports no breaches without a budget config', () => {
    const out = checkBudgets({
      manifest: { templates: { index: tpl('index', 1024 * 1024, 1024 * 1024) } },
      budget: undefined,
      sectionChunkBytes: {},
    });
    expect(out.breaches).toEqual([]);
    expect(out.shouldFail).toBe(false);
  });

  test('flags JS over per-template budget', () => {
    const out = checkBudgets({
      manifest: { templates: { product: tpl('product', 60 * 1024, 0) } },
      budget: { perTemplate: { jsKb: 50 }, onBreach: 'warn' },
      sectionChunkBytes: {},
    });
    expect(out.breaches).toEqual([
      { scope: 'template', handle: 'product', metric: 'js', actualKb: 60, limitKb: 50 },
    ]);
    expect(out.shouldFail).toBe(false);
  });

  test('shouldFail is true when onBreach is fail and there is a breach', () => {
    const out = checkBudgets({
      manifest: { templates: { product: tpl('product', 60 * 1024, 0) } },
      budget: { perTemplate: { jsKb: 50 }, onBreach: 'fail' },
      sectionChunkBytes: {},
    });
    expect(out.shouldFail).toBe(true);
  });

  test('flags CSS independently from JS', () => {
    const out = checkBudgets({
      manifest: { templates: { index: tpl('index', 0, 40 * 1024) } },
      budget: { perTemplate: { cssKb: 30 } },
      sectionChunkBytes: {},
    });
    expect(out.breaches).toEqual([
      { scope: 'template', handle: 'index', metric: 'css', actualKb: 40, limitKb: 30 },
    ]);
  });

  test('flags per-island JS over budget', () => {
    const manifest: BuildManifest = { templates: {} };
    const out = checkBudgets({
      manifest,
      budget: { perIsland: { jsKb: 20 } },
      sectionChunkBytes: { gallery: 30 * 1024, hero: 1024 },
    });
    expect(out.breaches).toEqual([
      { scope: 'island', handle: 'gallery', metric: 'js', actualKb: 30, limitKb: 20 },
    ]);
  });

  test('does not flag at or below the limit', () => {
    const out = checkBudgets({
      manifest: { templates: { index: tpl('index', 50 * 1024, 0) } },
      budget: { perTemplate: { jsKb: 50 } },
      sectionChunkBytes: {},
    });
    expect(out.breaches).toEqual([]);
  });
});
