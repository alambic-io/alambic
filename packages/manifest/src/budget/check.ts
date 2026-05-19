import type { BudgetBreach, BudgetCheckResult, PerformanceBudget } from '../types.js';
import type { BuildManifest } from '../types.js';

export interface CheckBudgetsOptions {
  readonly manifest: BuildManifest;
  readonly budget: PerformanceBudget | undefined;
  /**
   * Map of section handle → byte size of its `client.ts` chunk. Used for
   * the per-island budget ceiling (`budget.perIsland.jsKb`).
   */
  readonly sectionChunkBytes: Readonly<Record<string, number>>;
}

export function checkBudgets(opts: CheckBudgetsOptions): BudgetCheckResult {
  const breaches: BudgetBreach[] = [];
  const budget = opts.budget;
  if (!budget) return { breaches: [], shouldFail: false };

  const tplJsKb = budget.perTemplate?.jsKb;
  const tplCssKb = budget.perTemplate?.cssKb;
  for (const [handle, t] of Object.entries(opts.manifest.templates)) {
    if (typeof tplJsKb === 'number') {
      const actualKb = bytesToKb(t.jsBytes);
      if (actualKb > tplJsKb) {
        breaches.push({
          scope: 'template',
          handle,
          metric: 'js',
          actualKb,
          limitKb: tplJsKb,
        });
      }
    }
    if (typeof tplCssKb === 'number') {
      const actualKb = bytesToKb(t.cssBytes);
      if (actualKb > tplCssKb) {
        breaches.push({
          scope: 'template',
          handle,
          metric: 'css',
          actualKb,
          limitKb: tplCssKb,
        });
      }
    }
  }

  const islandJsKb = budget.perIsland?.jsKb;
  if (typeof islandJsKb === 'number') {
    for (const [handle, bytes] of Object.entries(opts.sectionChunkBytes)) {
      const actualKb = bytesToKb(bytes);
      if (actualKb > islandJsKb) {
        breaches.push({
          scope: 'island',
          handle,
          metric: 'js',
          actualKb,
          limitKb: islandJsKb,
        });
      }
    }
  }

  const shouldFail = breaches.length > 0 && budget.onBreach === 'fail';
  return { breaches, shouldFail };
}

function bytesToKb(bytes: number): number {
  // Round to one decimal — enough resolution for human-readable budgets.
  return Math.round((bytes / 1024) * 10) / 10;
}
