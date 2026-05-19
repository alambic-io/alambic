/**
 * Path mapping rules from the author-friendly nested layout under `src/`
 * to the flat Shopify-compliant layout the Shopify CLI consumes.
 *
 * Source                                  → Destination
 * ──────────────────────────────────────────────────────────────────
 * sections/<name>/index.liquid            → sections/<name>.liquid    (flatten)
 * sections/<name>.liquid                  → sections/<name>.liquid    (passthrough)
 * blocks/<name>/index.liquid              → blocks/<name>.liquid      (flatten)
 * blocks/<name>.liquid                    → blocks/<name>.liquid      (passthrough)
 * snippets/*.liquid                       → snippets/*.liquid         (passthrough)
 * templates/* /*.{liquid,json}            → same                      (passthrough)
 * config/*.json                           → same                      (passthrough)
 * locales/*.json                          → same                      (passthrough)
 * layout/*.liquid                         → same                      (passthrough)
 * assets/*                                → same                      (passthrough)
 *
 * Skipped (Vite-handled or non-theme):
 *   - *.ts, *.tsx, *.js, *.jsx, *.css, *.scss, *.sass
 *   - Files inside `sections/<name>/` or `blocks/<name>/` that aren't
 *     `index.liquid` (co-located TS/CSS get bundled by Vite and don't
 *      appear under those directories in the output)
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
 * Root-level dotfiles that pass through to staging untouched. These are
 * files Shopify CLI itself reads from the theme path during push/pull —
 * notably `.shopifyignore`, which selects which paths the push step
 * skips (merchant-owned templates, settings_data.json, section groups).
 *
 * Keep this list tight. Don't bring across `.env`, `.gitignore`, etc. —
 * they're not part of the deployed theme and Shopify CLI doesn't read
 * them from the path.
 */
const ROOT_DOTFILES = new Set(['.shopifyignore']);

/**
 * Map a single source path (relative to themeRoot) to its destination
 * (relative to output), or report that it should be skipped.
 *
 * Uses POSIX-style `/` separators on input. Callers normalize backslashes.
 */
export function mapFile(rel: string): MapResult {
  const path = rel.replace(/\\/g, '/');

  // Allowlisted root-level dotfiles (`.shopifyignore`) flow through as
  // passthrough copies. Anything else hidden — `.env`, `.gitignore`,
  // nested `.foo` files inside theme dirs — is skipped.
  if (path.startsWith('.') || path.includes('/.')) {
    if (!path.includes('/') && ROOT_DOTFILES.has(path)) {
      return { kind: 'mapped', dest: path };
    }
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

  // Same flattening for theme blocks: blocks/<name>/index.liquid → blocks/<name>.liquid
  const blockIndex = /^blocks\/([^/]+)\/index\.liquid$/.exec(path);
  if (blockIndex) {
    return { kind: 'mapped', dest: `blocks/${blockIndex[1]}.liquid` };
  }

  // Skip nested .liquid files in section/block folders that aren't index.liquid.
  if (/^sections\/[^/]+\/.+\.liquid$/.test(path)) {
    return {
      kind: 'skipped',
      reason: 'nested section .liquid (only index.liquid is mapped)',
    };
  }
  if (/^blocks\/[^/]+\/.+\.liquid$/.test(path)) {
    return {
      kind: 'skipped',
      reason: 'nested block .liquid (only index.liquid is mapped)',
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
