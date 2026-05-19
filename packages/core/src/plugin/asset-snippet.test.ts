import { describe, expect, it } from 'vitest';
import { renderBuildSnippet, renderDevSnippet } from './asset-snippet.js';

describe('renderDevSnippet', () => {
  it('includes a generated header and Vite client tag', () => {
    const out = renderDevSnippet({
      devUrl: 'http://localhost:5173',
      entries: [{ id: 'sections/product-card/client', file: 'sections/product-card/client.ts' }],
    });
    expect(out).toMatch(/alambic:generated/);
    expect(out).toContain('/@vite/client');
    expect(out).toContain('sections/product-card/client');
    expect(out).toContain('sections/product-card/client.ts');
  });

  it('trims trailing slash from devUrl', () => {
    const out = renderDevSnippet({
      devUrl: 'http://localhost:5173/',
      entries: [{ id: 'a', file: 'a.ts' }],
    });
    expect(out).toContain('http://localhost:5173/@vite/client');
    expect(out).not.toContain('http://localhost:5173//');
  });

  it('escapes single quotes in entry ids', () => {
    const out = renderDevSnippet({
      devUrl: 'http://x',
      entries: [{ id: "weird'name", file: 'x.ts' }],
    });
    expect(out).toContain("weird\\'name");
  });
});

describe('renderBuildSnippet', () => {
  it('inlines JS + CSS siblings per entry', () => {
    const out = renderBuildSnippet({
      manifest: {
        'layout/theme': {
          js: 'layout-theme-QL9QvpSf.js',
          css: ['theme-BUSL10WY.css'],
        },
      },
    });
    expect(out).toContain("when 'layout/theme'");
    expect(out).toContain("assign js_asset = 'layout-theme-QL9QvpSf.js'");
    expect(out).toContain("assign css_assets = 'theme-BUSL10WY.css'");
    expect(out).toContain('asset_url');
    expect(out).toContain('split');
  });

  it('joins multiple CSS files with comma for split inside Liquid', () => {
    const out = renderBuildSnippet({
      manifest: {
        x: { js: 'x.js', css: ['a.css', 'b.css', 'c.css'] },
      },
    });
    expect(out).toContain("assign css_assets = 'a.css,b.css,c.css'");
  });

  it('handles JS-only entries', () => {
    const out = renderBuildSnippet({
      manifest: { 'sections/hero/client': { js: 'sections-hero-client-abc.js' } },
    });
    expect(out).toContain("assign js_asset = 'sections-hero-client-abc.js'");
    expect(out).toContain("assign css_assets = ''");
  });

  it('emits a stub when manifest is empty', () => {
    const out = renderBuildSnippet({ manifest: {} });
    expect(out).toContain('no entries');
  });
});
