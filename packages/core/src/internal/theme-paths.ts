import { relative } from 'node:path';

/**
 * Conventional theme directory layout under `themeRoot`.
 */
export const THEME_DIRS = {
  sections: 'sections',
  snippets: 'snippets',
  templates: 'templates',
  config: 'config',
  locales: 'locales',
  layout: 'layout',
  assets: 'assets',
} as const;

/**
 * Turn an absolute filesystem path under `themeRoot` into a stable entry id
 * suitable for Vite's `build.rollupOptions.input`. Strips the extension and
 * normalizes separators to `/`.
 */
export function entryIdFor(themeRoot: string, file: string): string {
  const rel = relative(themeRoot, file).replace(/\\/g, '/');
  return rel.replace(/\.[^./]+$/, '');
}
