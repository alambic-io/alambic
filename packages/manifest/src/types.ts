/**
 * The asset graph for a single template.
 *
 * Aggregated from:
 *   - The template's section list (resolved from `templates/<name>.json` /
 *     `.liquid` + any referenced section groups).
 *   - The Vite build manifest (CSS + JS chunks per entry).
 *   - The islands manifest (per-section `client.ts` chunk file names).
 *
 * Asset paths are *relative to the theme's `assets/` directory* — the
 * filename is what Shopify's `asset_url` filter expects.
 */
export interface TemplateAssetGraph {
  /** Template handle, e.g. `index`, `product`, `404`. */
  readonly template: string;
  /** Sections rendered by this template (top-level + section-group entries). */
  readonly sections: ReadonlyArray<string>;
  /** Section JS chunks needed by this template (filenames in `assets/`). */
  readonly sectionChunks: ReadonlyArray<string>;
  /** CSS files (filenames in `assets/`) the template should load. */
  readonly cssFiles: ReadonlyArray<string>;
  /** Total JS bytes (sum of section chunks + any shared layout entry JS). */
  readonly jsBytes: number;
  /** Total CSS bytes. */
  readonly cssBytes: number;
}

/**
 * The shape emitted to disk + handed to the head-snippet generator.
 * Keys are template handles; values describe the assets needed.
 */
export interface BuildManifest {
  readonly templates: Readonly<Record<string, TemplateAssetGraph>>;
}

/**
 * Per-template performance budgets. Sizes are in kilobytes (raw, not
 * gzipped — gzip varies by server config; the build's job is to bound
 * what we ship to the wire).
 */
export interface PerformanceBudget {
  /** Per-template ceiling, sums of section + shared JS. */
  readonly perTemplate?: {
    readonly jsKb?: number;
    readonly cssKb?: number;
  };
  /** Per-section client.ts chunk ceiling. */
  readonly perIsland?: {
    readonly jsKb?: number;
  };
  /** What to do on breach. Default: `'warn'`. */
  readonly onBreach?: 'warn' | 'fail';
}

/** A single budget violation row. */
export interface BudgetBreach {
  readonly scope: 'template' | 'island';
  readonly handle: string;
  readonly metric: 'js' | 'css';
  readonly actualKb: number;
  readonly limitKb: number;
}

export interface BudgetCheckResult {
  readonly breaches: ReadonlyArray<BudgetBreach>;
  /** `true` if any breach exceeds limits AND `onBreach` is `'fail'`. */
  readonly shouldFail: boolean;
}
