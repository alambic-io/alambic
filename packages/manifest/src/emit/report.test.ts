import { describe, expect, test } from 'vitest';
import type { BuildManifest } from '../types.js';
import { renderReportJson, renderReportTable } from './report.js';

const manifest: BuildManifest = {
  templates: {
    index: {
      template: 'index',
      sections: ['hero', 'featured'],
      sectionChunks: ['sections-featured-client-abc.js'],
      cssFiles: ['theme.css'],
      jsBytes: 48 * 1024,
      cssBytes: 7 * 1024,
    },
    '404': {
      template: '404',
      sections: ['hero'],
      sectionChunks: [],
      cssFiles: ['theme.css'],
      jsBytes: 47 * 1024,
      cssBytes: 7 * 1024,
    },
  },
};

describe('renderReportJson', () => {
  test('emits a sorted templates array with KB sizes', () => {
    const out = renderReportJson({ manifest });
    expect(out.templates.map((t) => t.template)).toEqual(['404', 'index']);
    expect(out.templates[1]?.jsKb).toBe(48);
    expect(out.templates[1]?.cssKb).toBe(7);
  });

  test('includes the budget section only when a budget check was provided', () => {
    expect(renderReportJson({ manifest }).budget).toBeUndefined();
    const withBudget = renderReportJson({
      manifest,
      budgetCheck: {
        breaches: [{ scope: 'template', handle: 'index', metric: 'js', actualKb: 48, limitKb: 40 }],
        shouldFail: true,
      },
    });
    expect(withBudget.budget?.shouldFail).toBe(true);
    expect(withBudget.budget?.breaches).toHaveLength(1);
  });
});

describe('renderReportTable', () => {
  test('renders a fixed-width table sorted by template handle', () => {
    const out = renderReportTable({ manifest });
    expect(out).toContain('Template');
    expect(out).toContain('JS');
    expect(out).toContain('CSS');
    const lines = out.split('\n');
    const fourOhFour = lines.findIndex((l) => l.startsWith('404'));
    const index = lines.findIndex((l) => l.startsWith('index'));
    expect(fourOhFour).toBeGreaterThan(-1);
    expect(index).toBeGreaterThan(fourOhFour);
  });

  test('lists breaches under the table when present', () => {
    const out = renderReportTable({
      manifest,
      budgetCheck: {
        breaches: [{ scope: 'template', handle: 'index', metric: 'js', actualKb: 48, limitKb: 40 }],
        shouldFail: false,
      },
    });
    expect(out).toContain('Budget breaches:');
    expect(out).toContain('template "index": JS 48 KB > 40 KB');
  });

  test('handles an empty manifest gracefully', () => {
    expect(renderReportTable({ manifest: { templates: {} } })).toContain('No templates discovered');
  });
});
