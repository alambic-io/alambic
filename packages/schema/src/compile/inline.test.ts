import { describe, expect, it } from 'vitest';
import { findSchemaSpan, inlineSchema } from './inline.js';

describe('findSchemaSpan', () => {
  it('returns null when there is no schema block', () => {
    expect(findSchemaSpan('<h1>hi</h1>')).toBeNull();
  });

  it('finds a plain `{% schema %}…{% endschema %}` block', () => {
    const src = '<h1>x</h1>\n{% schema %}\n{ "name": "x" }\n{% endschema %}\n';
    const span = findSchemaSpan(src);
    expect(span).not.toBeNull();
    expect(src.slice(span!.start, span!.end)).toBe(
      '{% schema %}\n{ "name": "x" }\n{% endschema %}',
    );
  });

  it('handles whitespace markers `{%- schema -%}`', () => {
    const src = '<h1>x</h1>\n{%- schema -%}\n{ "name": "x" }\n{%- endschema -%}\n';
    const span = findSchemaSpan(src);
    expect(span).not.toBeNull();
    expect(src.slice(span!.start, span!.end)).toContain('endschema');
  });

  it('ignores `{% schema %}` written inside a `{% comment %}` block', () => {
    const src =
      '<h1>x</h1>\n' +
      '{% comment %}{% schema %}fake{% endschema %}{% endcomment %}\n' +
      '{% schema %}\n{ "name": "real" }\n{% endschema %}\n';
    const span = findSchemaSpan(src);
    expect(span).not.toBeNull();
    expect(src.slice(span!.start, span!.end)).toContain('"name": "real"');
  });

  it('ignores `{% schema %}` written inside a `{% raw %}` block', () => {
    const src =
      '{% raw %}{% schema %}fake{% endschema %}{% endraw %}\n' +
      '{% schema %}\n{ "name": "real" }\n{% endschema %}\n';
    const span = findSchemaSpan(src);
    expect(span).not.toBeNull();
    expect(src.slice(span!.start, span!.end)).toContain('"name": "real"');
  });

  it('throws on an unclosed `{% schema %}`', () => {
    expect(() => findSchemaSpan('{% schema %}\n{ }\n')).toThrowError(/endschema/);
  });
});

describe('inlineSchema', () => {
  it('replaces an existing schema block', () => {
    const src = '<h1>x</h1>\n{% schema %}\n{"name":"old"}\n{% endschema %}\n';
    const out = inlineSchema(src, { body: '{\n  "name": "new"\n}\n' });
    expect(out).toContain('"name": "new"');
    expect(out).not.toContain('"name":"old"');
  });

  it('appends a schema block when none exists', () => {
    const src = '<h1>x</h1>';
    const out = inlineSchema(src, { body: '{\n  "name": "x"\n}\n' });
    expect(out).toMatch(
      /<h1>x<\/h1>\n\n\{% schema %\}\n\{\n {2}"name": "x"\n}\n\{% endschema %\}\n$/,
    );
  });

  it('preserves content before/after the schema block', () => {
    const src =
      '<section>{{ section.settings.heading }}</section>\n' +
      '{% schema %}\n{"name":"old"}\n{% endschema %}\n' +
      '<!-- trailing -->';
    const out = inlineSchema(src, { body: '{\n  "name": "new"\n}\n' });
    expect(out.startsWith('<section>{{ section.settings.heading }}</section>')).toBe(true);
    expect(out.endsWith('<!-- trailing -->')).toBe(true);
    expect(out).toContain('"name": "new"');
  });

  it('emits exactly one trailing newline after the schema block when appending', () => {
    const src = '<h1>x</h1>\n\n\n';
    const out = inlineSchema(src, { body: '{}\n' });
    expect(out.match(/\n+$/)![0]).toBe('\n');
  });

  it("doesn't touch a `{% schema %}` written inside a comment", () => {
    const src = '{% comment %}{% schema %}fake{% endschema %}{% endcomment %}\n';
    const out = inlineSchema(src, { body: '{\n  "name": "appended"\n}\n' });
    // The fake schema-in-comment is left alone; the real one is appended.
    expect(out).toContain('{% comment %}{% schema %}fake{% endschema %}{% endcomment %}');
    expect(out).toContain('"name": "appended"');
  });
});
