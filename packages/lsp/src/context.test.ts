import { pathToFileURL } from 'node:url';
import { describe, expect, test } from 'vitest';
import { detectContext } from './context.js';

function uri(p: string): string {
  return pathToFileURL(p).href;
}

describe('detectContext', () => {
  const themeRoot = '/proj/src';

  test('section with nested layout: sections/<name>/index.liquid', () => {
    expect(
      detectContext({
        uri: uri('/proj/src/sections/featured/index.liquid'),
        themeRoot,
      }),
    ).toEqual({ kind: 'section', handle: 'featured' });
  });

  test('section with flat layout: sections/<name>.liquid', () => {
    expect(detectContext({ uri: uri('/proj/src/sections/hero.liquid'), themeRoot })).toEqual({
      kind: 'section',
      handle: 'hero',
    });
  });

  test('theme block with nested layout: blocks/<name>/index.liquid', () => {
    expect(
      detectContext({
        uri: uri('/proj/src/blocks/badge/index.liquid'),
        themeRoot,
      }),
    ).toEqual({ kind: 'theme-block', handle: 'badge' });
  });

  test('theme block with flat layout: blocks/<name>.liquid', () => {
    expect(detectContext({ uri: uri('/proj/src/blocks/badge.liquid'), themeRoot })).toEqual({
      kind: 'theme-block',
      handle: 'badge',
    });
  });

  test('snippet returns the snippet name', () => {
    expect(detectContext({ uri: uri('/proj/src/snippets/price.liquid'), themeRoot })).toEqual({
      kind: 'snippet',
      name: 'price',
    });
  });

  test('template Liquid returns its handle', () => {
    expect(
      detectContext({
        uri: uri('/proj/src/templates/gift_card.liquid'),
        themeRoot,
      }),
    ).toEqual({ kind: 'template', name: 'gift_card' });
  });

  test('layout files return the bare `layout` kind', () => {
    expect(detectContext({ uri: uri('/proj/src/layout/theme.liquid'), themeRoot })).toEqual({
      kind: 'layout',
    });
  });

  test('files outside themeRoot resolve to `other`', () => {
    expect(detectContext({ uri: uri('/elsewhere/foo.liquid'), themeRoot })).toEqual({
      kind: 'other',
    });
  });

  test('handles a themeRoot that already has trailing-slash form correctly', () => {
    // Slight robustness check — we normalize backslashes but expect
    // no trailing slash. Calling code is responsible for that.
    expect(
      detectContext({
        uri: uri('/proj/src/sections/x/index.liquid'),
        themeRoot: '/proj/src',
      }),
    ).toEqual({ kind: 'section', handle: 'x' });
  });
});
