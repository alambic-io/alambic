import type { CheckResult } from './types.js';

const ICON = {
  pass: '✓',
  warn: '⚠',
  fail: '✗',
} as const;

/**
 * Group results by their `group` field and render a human-readable
 * summary block. Stable order: groups appear in insertion order.
 */
export function formatResults(results: ReadonlyArray<CheckResult>): string[] {
  const lines: string[] = [];
  const groups = new Map<string, CheckResult[]>();
  for (const r of results) {
    const arr = groups.get(r.group) ?? [];
    arr.push(r);
    groups.set(r.group, arr);
  }
  for (const [group, items] of groups) {
    lines.push(group);
    for (const r of items) {
      const icon = ICON[r.severity];
      lines.push(`  ${icon} ${r.name}: ${r.message}`);
      if (r.hint && r.severity !== 'pass') {
        lines.push(`      → ${r.hint}`);
      }
    }
    lines.push('');
  }
  return lines;
}
