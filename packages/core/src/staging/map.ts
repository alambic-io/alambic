/**
 * Path mapping rules from the author-friendly nested layout under `src/`
 * to the flat Shopify-compliant layout the Shopify CLI consumes.
 *
 * Source                                  → Destination
 * ──────────────────────────────────────────────────────────────────
 * sections/<name>/index.liquid            → sections/<name>.liquid
 * sections/<name>.liquid                  → sections/<name>.liquid
 * snippets/*.liquid                       → snippets/*.liquid       (passthrough)
 * templates/* /*.{liquid,json}            → same                    (passthrough)
 * config/*.json                           → same                    (passthrough)
 * locales/*.json                          → same                    (passthrough)
 * layout/*.liquid                         → same                    (passthrough)
 * blocks/*.liquid                         → same                    (passthrough)
 * assets/*                                → same                    (passthrough)
 *
 * Skipped (Vite-handled or non-theme):
 *   - *.ts, *.tsx, *.js, *.jsx, *.css, *.scss, *.sass
 *   - Files inside `sections/<name>/` that aren't `index.liquid`
 *     (placeholder rule for Phase 1; co-located TS/CSS get bundled
 *      by Vite and don't appear under `sections/` in the output)
 */

export interface MappedFile {
  /** Path relative to themeRoot, the source file. */
  source: string;
  /** Path relative to output, the destination file. */
  dest: string;
}

export type MapResult = { kind: 'mapped'; dest: string } | { kind: 'skipped'; reason: string };

const VITE_HANDLED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.scss',
  '.sass',
  '.less',
]);

const THEME_DIRS = new Set([
  'sections',
  'snippets',
  'templates',
  'config',
  'locales',
  'layout',
  'blocks',
  'assets',
]);

/**
 * Map a single source path (relative to themeRoot) to its destination
 * (relative to output), or report that it should be skipped.
 *
 * Uses POSIX-style `/` separators on input. Callers normalize backslashes.
 */
export function mapFile(rel: string): MapResult {
  const path = rel.replace(/\\/g, '/');

  // Hidden files and other noise.
  if (path.startsWith('.') || path.includes('/.')) {
    return { kind: 'skipped', reason: 'hidden file' };
  }

  const ext = extname(path);
  if (VITE_HANDLED_EXTENSIONS.has(ext)) {
    return { kind: 'skipped', reason: 'handled by Vite' };
  }

  // Only files inside known theme directories propagate. Anything else
  // (package.json, alambic.config.ts, READMEs at theme root, etc.) is
  // not part of the theme output.
  const top = path.split('/', 1)[0] ?? '';
  if (!THEME_DIRS.has(top)) {
    return { kind: 'skipped', reason: 'not under a theme directory' };
  }

  // Flatten section folders: sections/<name>/index.liquid → sections/<name>.liquid
  const sectionIndex = /^sections\/([^/]+)\/index\.liquid$/.exec(path);
  if (sectionIndex) {
    return { kind: 'mapped', dest: `sections/${sectionIndex[1]}.liquid` };
  }

  // Reject (skip) other .liquid files inside section folders. The author
  // can still co-locate `.ts`/`.css` files there (Vite handles them);
  // multiple section liquids per folder don't have a Phase 1 convention.
  const nestedSectionLiquid = /^sections\/[^/]+\/.+\.liquid$/.exec(path);
  if (nestedSectionLiquid) {
    return {
      kind: 'skipped',
      reason: 'nested section .liquid (only index.liquid is mapped)',
    };
  }

  return { kind: 'mapped', dest: path };
}

function extname(path: string): string {
  const i = path.lastIndexOf('.');
  if (i === -1) return '';
  const slash = path.lastIndexOf('/');
  if (i < slash) return '';
  return path.slice(i);
}
