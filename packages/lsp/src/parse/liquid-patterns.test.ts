import { describe, expect, test } from 'vitest';
import {
  findCompletionContext,
  findLocaleReferences,
  findSettingReferences,
  leadingExpression,
} from './liquid-patterns.js';

describe('leadingExpression', () => {
  test('returns text from the last `{{` opener up to the offset', () => {
    const src = `<div>{{ section.settings.head`;
    expect(leadingExpression(src, src.length)).toBe('{{ section.settings.head');
  });

  test('returns text from the last `{%` opener up to the offset', () => {
    const src = `<x>{% render 'fo`;
    expect(leadingExpression(src, src.length)).toBe("{% render 'fo");
  });

  test('falls back to lookback window if no opener is present', () => {
    const src = `<p>nothing here yet</p>`;
    const out = leadingExpression(src, src.length);
    expect(out).toContain('nothing here yet');
  });
});

describe('findCompletionContext', () => {
  test('detects section.settings.<X> with a partial prefix', () => {
    const src = `{{ section.settings.head`;
    const out = findCompletionContext(src, src.length);
    expect(out).toEqual({ kind: 'section-setting', prefix: 'head' });
  });

  test('detects section.settings.<empty> after the dot', () => {
    const src = `{{ section.settings.`;
    const out = findCompletionContext(src, src.length);
    expect(out).toEqual({ kind: 'section-setting', prefix: '' });
  });

  test('detects block.settings.<X>', () => {
    const src = `{{ block.settings.lab`;
    const out = findCompletionContext(src, src.length);
    expect(out).toEqual({ kind: 'block-setting', prefix: 'lab' });
  });

  test('detects locale-key when cursor is inside a single-quoted string in a `{{` expression', () => {
    const src = `{{ 'cart.emp`;
    const out = findCompletionContext(src, src.length);
    expect(out).toEqual({ kind: 'locale-key', prefix: 'cart.emp', quote: "'" });
  });

  test('does NOT fire locale-key inside a `{%` tag (only inside output expressions)', () => {
    // `{% assign x = 'foo' %}` shouldn't trigger locale completion.
    const src = `{% assign x = 'foo`;
    const out = findCompletionContext(src, src.length);
    expect(out.kind).not.toBe('locale-key');
  });

  test('detects render-tag snippet name completion', () => {
    const src = `{% render 'pric`;
    const out = findCompletionContext(src, src.length);
    expect(out).toEqual({ kind: 'render', prefix: 'pric', quote: "'" });
  });

  test('detects section-tag completion with double quotes', () => {
    const src = `{% section "he`;
    const out = findCompletionContext(src, src.length);
    expect(out).toEqual({ kind: 'section-tag', prefix: 'he', quote: '"' });
  });

  test('returns none outside of Liquid markers', () => {
    const src = `<h1>just html</h1>`;
    expect(findCompletionContext(src, src.length).kind).toBe('none');
  });

  test('handles the section.settings prefix when followed by other text', () => {
    // Cursor placed in the middle of an expression.
    const src = `{{ section.settings.head | escape }}`;
    const cursorAt = '{{ section.settings.head'.length;
    expect(findCompletionContext(src, cursorAt)).toEqual({
      kind: 'section-setting',
      prefix: 'head',
    });
  });
});

describe('findLocaleReferences', () => {
  test("finds every `'key' | t` reference and reports its range", () => {
    const src = `<a>{{ 'cart.add' | t }}</a><b>{{ 'go.home' | t: count: 1 }}</b>`;
    const out = findLocaleReferences(src);
    expect(out.map((r) => r.key)).toEqual(['cart.add', 'go.home']);
    expect(src.slice(out[0]?.start ?? 0, out[0]?.end ?? 0)).toBe('cart.add');
  });

  test('ignores strings that are not piped through `t`', () => {
    const src = `{{ 'not.translated' }}`;
    expect(findLocaleReferences(src)).toEqual([]);
  });

  test('handles double-quoted keys', () => {
    const src = `{{ "footer.copyright" | t }}`;
    const out = findLocaleReferences(src);
    expect(out[0]?.key).toBe('footer.copyright');
  });
});

describe('findSettingReferences', () => {
  test('finds section.settings.<id> with its range', () => {
    const src = `<h1>{{ section.settings.heading }}</h1>`;
    const out = findSettingReferences(src);
    expect(out).toHaveLength(1);
    expect(out[0]?.scope).toBe('section');
    expect(out[0]?.id).toBe('heading');
    expect(src.slice(out[0]?.start ?? 0, out[0]?.end ?? 0)).toBe('heading');
  });

  test('finds block.settings.<id>', () => {
    const src = `{{ block.settings.label }}`;
    const out = findSettingReferences(src);
    expect(out[0]?.scope).toBe('block');
    expect(out[0]?.id).toBe('label');
  });

  test('finds multiple references across the document', () => {
    const src = `{{ section.settings.a }} {{ block.settings.b }} {{ section.settings.c }}`;
    const out = findSettingReferences(src);
    expect(out.map((r) => `${r.scope}.${r.id}`)).toEqual(['section.a', 'block.b', 'section.c']);
  });
});
