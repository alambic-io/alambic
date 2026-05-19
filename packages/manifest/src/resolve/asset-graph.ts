import type { BuildManifest, TemplateAssetGraph } from '../types.js';
import type { ResolvedTemplate } from './template-tree.js';

/**
 * Inputs to the per-template asset-graph builder.
 *
 * Why we don't take Rollup's `bundle` directly: the manifest package
 * stays platform-agnostic and easily unit-testable. `@alambic/core`
 * extracts a small POJO summary from the bundle and hands it here.
 */
export interface BuildAssetGraphOptions {
  readonly templates: ReadonlyArray<ResolvedTemplate>;
  /**
   * Map of section handle → asset file name (e.g.
   * `'featured' -> 'sections-featured-client-abc123.js'`). Same shape the
   * islands snippet writer consumes.
   */
  readonly sectionChunks: Readonly<Record<string, string>>;
  /**
   * Map of asset file name → raw byte size. Used for size aggregation
   * and budget checks. Entries not present default to 0 bytes (i.e.
   * the resolver treats missing-size as not-a-budget-concern).
   */
  readonly assetBytes: Readonly<Record<string, number>>;
  /**
   * CSS files shared across all templates (e.g. the layout entry's
   * extracted CSS). Listed under every template's `cssFiles` and
   * counted in `cssBytes`.
   */
  readonly sharedCss?: ReadonlyArray<string>;
  /**
   * JS files shared across all templates (e.g. the islands runtime, the
   * layout entry's JS). Counted in `jsBytes` but not in `sectionChunks`.
   */
  readonly sharedJs?: ReadonlyArray<string>;
}

export function buildAssetGraph(opts: BuildAssetGraphOptions): BuildManifest {
  const sharedCss = opts.sharedCss ?? [];
  const sharedJs = opts.sharedJs ?? [];
  const sharedJsBytes = sumBytes(sharedJs, opts.assetBytes);
  const sharedCssBytes = sumBytes(sharedCss, opts.assetBytes);

  const out: Record<string, TemplateAssetGraph> = {};
  for (const tpl of opts.templates) {
    const matchedSections = tpl.sectionTypes.filter((s) => Boolean(opts.sectionChunks[s]));
    const sectionChunks = matchedSections.map((s) => opts.sectionChunks[s] as string);
    const sectionJsBytes = sumBytes(sectionChunks, opts.assetBytes);

    out[tpl.handle] = {
      template: tpl.handle,
      sections: tpl.sectionTypes,
      sectionChunks,
      cssFiles: sharedCss,
      jsBytes: sharedJsBytes + sectionJsBytes,
      cssBytes: sharedCssBytes,
    };
  }
  return { templates: out };
}

function sumBytes(
  files: ReadonlyArray<string>,
  bytesMap: Readonly<Record<string, number>>,
): number {
  let total = 0;
  for (const f of files) total += bytesMap[f] ?? 0;
  return total;
}
