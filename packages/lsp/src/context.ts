/**
 * Map a Liquid file URI to its theme context — i.e. which schema (if
 * any) applies. Used by completion + diagnostics to scope suggestions.
 *
 * Cases we handle:
 *   - `<themeRoot>/sections/<name>/index.liquid` → section context
 *   - `<themeRoot>/sections/<name>.liquid` (flat author form) → section context
 *   - `<themeRoot>/blocks/<name>/index.liquid` → theme-block context
 *   - `<themeRoot>/blocks/<name>.liquid` → theme-block context
 *   - anything else (snippets, templates, layout) → no specific schema
 *
 * URIs use POSIX-style paths even on Windows after `vscode-uri` parses
 * them, so we deal in `/`.
 */
import { fileURLToPath } from 'node:url';

export type LiquidContext =
  | { readonly kind: 'section'; readonly handle: string }
  | { readonly kind: 'theme-block'; readonly handle: string }
  | { readonly kind: 'snippet'; readonly name: string }
  | { readonly kind: 'template'; readonly name: string }
  | { readonly kind: 'layout' }
  | { readonly kind: 'other' };

export interface DetectContextOptions {
  readonly uri: string;
  readonly themeRoot: string;
}

export function detectContext(opts: DetectContextOptions): LiquidContext {
  const filePath = uriToPath(opts.uri);
  if (!filePath) return { kind: 'other' };
  const themeRoot = opts.themeRoot.replace(/\\/g, '/');
  const file = filePath.replace(/\\/g, '/');
  if (!file.startsWith(`${themeRoot}/`)) return { kind: 'other' };
  const rel = file.slice(themeRoot.length + 1);

  // sections/<name>/index.liquid  OR  sections/<name>.liquid
  const sectionFolder = /^sections\/([^/]+)\/index\.liquid$/.exec(rel);
  if (sectionFolder?.[1]) return { kind: 'section', handle: sectionFolder[1] };
  const sectionFlat = /^sections\/([^/]+)\.liquid$/.exec(rel);
  if (sectionFlat?.[1]) return { kind: 'section', handle: sectionFlat[1] };

  // blocks/<name>/index.liquid  OR  blocks/<name>.liquid
  const blockFolder = /^blocks\/([^/]+)\/index\.liquid$/.exec(rel);
  if (blockFolder?.[1]) return { kind: 'theme-block', handle: blockFolder[1] };
  const blockFlat = /^blocks\/([^/]+)\.liquid$/.exec(rel);
  if (blockFlat?.[1]) return { kind: 'theme-block', handle: blockFlat[1] };

  const snippet = /^snippets\/([^/]+)\.liquid$/.exec(rel);
  if (snippet?.[1]) return { kind: 'snippet', name: snippet[1] };

  const template = /^templates\/([^/]+)\.liquid$/.exec(rel);
  if (template?.[1]) return { kind: 'template', name: template[1] };

  if (rel.startsWith('layout/')) return { kind: 'layout' };
  return { kind: 'other' };
}

function uriToPath(uri: string): string | null {
  try {
    return fileURLToPath(uri);
  } catch {
    return null;
  }
}
