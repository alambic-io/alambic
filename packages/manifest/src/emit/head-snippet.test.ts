import { describe, expect, test } from 'vitest';
import { renderHeadSnippet } from './head-snippet.js';

describe('renderHeadSnippet', () => {
  test('emits a case/when block with modulepreload tags per template', () => {
    const out = renderHeadSnippet({
      templates: {
        index: {
          template: 'index',
          sections: ['hero', 'featured'],
          sectionChunks: ['sections-featured-client-abc.js'],
          cssFiles: [],
          jsBytes: 0,
          cssBytes: 0,
        },
        '404': {
          template: '404',
          sections: ['hero'],
          sectionChunks: [],
          cssFiles: [],
          jsBytes: 0,
          cssBytes: 0,
        },
      },
    });
    expect(out).toContain('alambic:generated');
    expect(out).toContain('{%- case __alambic_t -%}');
    expect(out).toContain("{%- when '404' -%}");
    expect(out).toContain("{%- when 'index' -%}");
    expect(out).toContain(
      `<link rel="modulepreload" href="{{ 'sections-featured-client-abc.js' | asset_url }}">`,
    );
    expect(out).toContain('{%- endcase -%}');
  });

  test('emits no preload when a template has no section chunks', () => {
    const out = renderHeadSnippet({
      templates: {
        '404': {
          template: '404',
          sections: ['hero'],
          sectionChunks: [],
          cssFiles: [],
          jsBytes: 0,
          cssBytes: 0,
        },
      },
    });
    expect(out).toContain("{%- when '404' -%}");
    expect(out).not.toContain('modulepreload');
  });

  test('returns a no-op snippet when no templates are present', () => {
    const out = renderHeadSnippet({ templates: {} });
    expect(out).toContain('no templates discovered');
    expect(out).not.toContain('case');
  });

  test('escapes single quotes in template handles', () => {
    const out = renderHeadSnippet({
      templates: {
        "odd'name": {
          template: "odd'name",
          sections: [],
          sectionChunks: [],
          cssFiles: [],
          jsBytes: 0,
          cssBytes: 0,
        },
      },
    });
    expect(out).toContain("'odd\\'name'");
  });
});
