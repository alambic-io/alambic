import { describe, expect, test } from 'vitest';
import {
  buildManifestToLiquid,
  islandsRuntimeEntryPath,
  renderIslandsSnippet,
  renderIslandsSnippetBuild,
} from './snippets.js';

describe('renderIslandsSnippet (dev)', () => {
  test('inlines the manifest as a JSON-shaped script and appends the runtime tag', () => {
    const out = renderIslandsSnippet({
      runtimeScriptTag: '<script type="module" src="http://localhost:5173/runtime.mjs"></script>',
      manifest: { entries: { hero: '/_islands/hero.js' } },
    });
    expect(out).toContain('alambic:generated');
    expect(out).toContain('window.__alambic = window.__alambic || {}');
    expect(out).toContain('"entries":{"hero":"/_islands/hero.js"}');
    expect(out).toContain(
      '<script type="module" src="http://localhost:5173/runtime.mjs"></script>',
    );
  });

  test('emits an empty entries object when no sections are present', () => {
    const out = renderIslandsSnippet({
      runtimeScriptTag: '<script type="module" src="x"></script>',
      manifest: { entries: {} },
    });
    expect(out).toContain('"entries":{}');
  });
});

describe('buildManifestToLiquid', () => {
  test('wraps each asset name in an asset_url Liquid expression', () => {
    const out = buildManifestToLiquid({
      hero: 'sections-hero-client-abc123.js',
      featured: 'sections-featured-client-def456.js',
    });
    expect(out['hero']).toBe("{{ 'sections-hero-client-abc123.js' | asset_url }}");
    expect(out['featured']).toBe("{{ 'sections-featured-client-def456.js' | asset_url }}");
  });

  test('escapes single quotes and backslashes inside asset names', () => {
    const out = buildManifestToLiquid({ weird: "name'with\\quote.js" });
    expect(out['weird']).toBe("{{ 'name\\'with\\\\quote.js' | asset_url }}");
  });
});

describe('renderIslandsSnippetBuild', () => {
  test('emits a Liquid-interpolated manifest and a script tag pointing at the runtime asset', () => {
    const out = renderIslandsSnippetBuild({
      runtimeAssetName: 'alambic-runtime-abc123.js',
      manifest: {
        hero: 'sections-hero-client-1.js',
        featured: 'sections-featured-client-2.js',
      },
    });
    expect(out).toContain('alambic:generated');
    expect(out).toContain('"hero": "{{ \'sections-hero-client-1.js\' | asset_url }}"');
    expect(out).toContain('"featured": "{{ \'sections-featured-client-2.js\' | asset_url }}"');
    expect(out).toContain(
      `<script type="module" src="{{ 'alambic-runtime-abc123.js' | asset_url }}"></script>`,
    );
  });

  test('handles an empty manifest without producing invalid JSON', () => {
    const out = renderIslandsSnippetBuild({
      runtimeAssetName: 'alambic-runtime.js',
      manifest: {},
    });
    expect(out).toContain('"entries": {\n\n} }');
  });

  test('escapes embedded quotes in section handles', () => {
    const out = renderIslandsSnippetBuild({
      runtimeAssetName: 'r.js',
      manifest: { 'odd"name': 'a.js' },
    });
    expect(out).toContain('"odd\\"name"');
  });
});

describe('islandsRuntimeEntryPath', () => {
  test('returns an absolute path to a runtime entry sibling of this module', () => {
    const p = islandsRuntimeEntryPath();
    expect(p.startsWith('/')).toBe(true);
    expect(p.endsWith('runtime.mjs')).toBe(true);
  });
});
