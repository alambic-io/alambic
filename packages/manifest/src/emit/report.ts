import type { BudgetCheckResult, BuildManifest } from '../types.js';

export interface ReportOptions {
  readonly manifest: BuildManifest;
  readonly budgetCheck?: BudgetCheckResult;
}

/**
 * The shape of `dist/alambic-report.json` (or whatever path the CLI
 * tells us). Designed for CI dashboards + Claude Code consumption —
 * stable enough that downstream tools can depend on it.
 */
export interface ReportJson {
  readonly templates: ReadonlyArray<{
    readonly template: string;
    readonly jsKb: number;
    readonly cssKb: number;
    readonly sections: ReadonlyArray<string>;
    readonly sectionChunks: ReadonlyArray<string>;
  }>;
  readonly budget?: {
    readonly breaches: BudgetCheckResult['breaches'];
    readonly shouldFail: boolean;
  };
}

export function renderReportJson(opts: ReportOptions): ReportJson {
  const templates = Object.values(opts.manifest.templates)
    .map((t) => ({
      template: t.template,
      jsKb: bytesToKb(t.jsBytes),
      cssKb: bytesToKb(t.cssBytes),
      sections: t.sections,
      sectionChunks: t.sectionChunks,
    }))
    .sort((a, b) => a.template.localeCompare(b.template));

  return {
    templates,
    ...(opts.budgetCheck
      ? { budget: { breaches: opts.budgetCheck.breaches, shouldFail: opts.budgetCheck.shouldFail } }
      : {}),
  };
}

/**
 * A compact, fixed-width text table for terminal output. Logged at the
 * end of every build; the budget breaches (if any) are appended below.
 */
export function renderReportTable(opts: ReportOptions): string {
  const rows = Object.values(opts.manifest.templates).sort((a, b) =>
    a.template.localeCompare(b.template),
  );
  if (rows.length === 0) return 'No templates discovered.\n';

  const cols = ['Template', 'JS', 'CSS', 'Sections'];
  const data = rows.map((r) => [
    r.template,
    formatKb(r.jsBytes),
    formatKb(r.cssBytes),
    r.sections.join(', ') || '—',
  ]);

  const widths = cols.map((c, i) => Math.max(c.length, ...data.map((row) => row[i]?.length ?? 0)));

  const fmtRow = (cells: ReadonlyArray<string>) =>
    cells.map((c, i) => (c ?? '').padEnd(widths[i] ?? 0)).join('  ');

  const lines: string[] = [];
  lines.push(fmtRow(cols));
  lines.push(widths.map((w) => '─'.repeat(w)).join('  '));
  for (const row of data) lines.push(fmtRow(row));

  const breaches = opts.budgetCheck?.breaches ?? [];
  if (breaches.length > 0) {
    lines.push('');
    lines.push('Budget breaches:');
    for (const b of breaches) {
      lines.push(
        `  ✗ ${b.scope} "${b.handle}": ${b.metric.toUpperCase()} ${b.actualKb} KB > ${b.limitKb} KB`,
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

function bytesToKb(bytes: number): number {
  return Math.round((bytes / 1024) * 10) / 10;
}

function formatKb(bytes: number): string {
  return `${bytesToKb(bytes).toFixed(1)} KB`;
}
