import { describe, expect, it } from 'vitest';
import { mapFile } from './map.js';

describe('mapFile', () => {
  it('flattens sections/<name>/index.liquid to sections/<name>.liquid', () => {
    const r = mapFile('sections/hero/index.liquid');
    expect(r).toEqual({ kind: 'mapped', dest: 'sections/hero.liquid' });
  });

  it('passes through flat sections/<name>.liquid', () => {
    expect(mapFile('sections/hero.liquid')).toEqual({
      kind: 'mapped',
      dest: 'sections/hero.liquid',
    });
  });

  it('passes through snippets, templates, config, locales, layout, blocks, assets', () => {
    for (const p of [
      'snippets/foo.liquid',
      'templates/index.json',
      'templates/product.liquid',
      'config/settings_schema.json',
      'config/settings_data.json',
      'locales/en.default.json',
      'layout/theme.liquid',
      'blocks/_text.liquid',
      'assets/logo.svg',
    ]) {
      expect(mapFile(p)).toEqual({ kind: 'mapped', dest: p });
    }
  });

  it('skips files Vite handles', () => {
    expect(mapFile('layout/theme.ts').kind).toBe('skipped');
    expect(mapFile('sections/hero/client.ts').kind).toBe('skipped');
    expect(mapFile('layout/theme.css').kind).toBe('skipped');
    expect(mapFile('sections/hero/index.css').kind).toBe('skipped');
  });

  it('skips files outside known theme directories', () => {
    expect(mapFile('package.json').kind).toBe('skipped');
    expect(mapFile('README.md').kind).toBe('skipped');
    expect(mapFile('alambic.config.ts').kind).toBe('skipped');
  });

  it('skips hidden files', () => {
    expect(mapFile('.DS_Store').kind).toBe('skipped');
    expect(mapFile('sections/.DS_Store').kind).toBe('skipped');
  });

  it('skips nested section .liquid files that are not index.liquid', () => {
    const r = mapFile('sections/hero/partial.liquid');
    expect(r.kind).toBe('skipped');
  });

  it('normalizes Windows-style backslashes', () => {
    expect(mapFile('sections\\hero\\index.liquid')).toEqual({
      kind: 'mapped',
      dest: 'sections/hero.liquid',
    });
  });
});
