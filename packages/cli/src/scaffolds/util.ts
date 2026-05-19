/**
 * Shared helpers for `alambic new <kind> <name>` scaffolds.
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const VALID_NAME = /^[a-z][a-z0-9-]{0,49}$/;

export function validateName(name: string): void {
  if (!VALID_NAME.test(name)) {
    throw new Error(
      `Invalid name "${name}". Names must be lowercase letters, digits, and hyphens; ` +
        'starting with a letter; 1–50 characters.',
    );
  }
}

// Template handles are looser than section/block names: Shopify accepts
// digits-first (404), underscores (gift_card), and dot-separated suffix
// variants (product.alternate). We don't support nested template paths.
const VALID_TEMPLATE_NAME = /^[a-z0-9][a-z0-9_-]{0,49}(\.[a-z0-9][a-z0-9_-]{0,49})?$/;

export function validateTemplateName(name: string): void {
  if (!VALID_TEMPLATE_NAME.test(name)) {
    throw new Error(
      `Invalid template name "${name}". Templates accept lowercase letters, digits, ` +
        'hyphens, and underscores, with an optional `.suffix` (e.g. `product.alternate`). ' +
        'Slashes are not supported.',
    );
  }
}

/** Simple `{{token}}` substitution. Unknown tokens pass through. */
export function substitute(input: string, vars: Readonly<Record<string, string>>): string {
  return input.replaceAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (match, key: string) => {
    return Object.hasOwn(vars, key) ? (vars[key] ?? match) : match;
  });
}

export interface ScaffoldFile {
  /** Absolute destination path. */
  path: string;
  /** Source content with `{{token}}` placeholders. */
  template: string;
}

export interface ScaffoldResult {
  written: string[];
  skipped: string[];
}

/**
 * Write a batch of files. Refuses to overwrite existing files (returns
 * them in `skipped`). Substitutes `{{token}}` from `vars` first.
 */
export async function writeScaffold(
  files: ReadonlyArray<ScaffoldFile>,
  vars: Readonly<Record<string, string>>,
  options: { overwrite?: boolean } = {},
): Promise<ScaffoldResult> {
  const written: string[] = [];
  const skipped: string[] = [];
  for (const file of files) {
    if (!options.overwrite && existsSync(file.path)) {
      skipped.push(file.path);
      continue;
    }
    await mkdir(dirname(file.path), { recursive: true });
    await writeFile(file.path, substitute(file.template, vars), 'utf8');
    written.push(file.path);
  }
  return { written, skipped };
}

/** Convert `product-card` → `productCard` (for TS identifiers). */
export function toCamelCase(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
}

/** Convert `product-card` → `Product card` (for human labels). */
export function toLabel(name: string): string {
  const spaced = name.replace(/-/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
