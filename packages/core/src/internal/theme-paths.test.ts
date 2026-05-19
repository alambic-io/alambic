import { describe, expect, it } from 'vitest';
import { entryIdFor } from './theme-paths.js';

describe('entryIdFor', () => {
  it('produces a stable id relative to themeRoot, without extension', () => {
    expect(entryIdFor('/proj/src', '/proj/src/sections/product-card/client.ts')).toBe(
      'sections/product-card/client',
    );
  });

  it('normalizes backslashes', () => {
    expect(entryIdFor('C:/proj/src', 'C:/proj/src/snippets/foo.ts')).toBe('snippets/foo');
  });

  it('handles files at the theme root', () => {
    expect(entryIdFor('/proj/src', '/proj/src/main.ts')).toBe('main');
  });
});
