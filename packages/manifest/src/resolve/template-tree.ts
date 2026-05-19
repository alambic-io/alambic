import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Parse every template under `<themeDir>/templates/` and resolve which
 * sections each one renders. Reads from the *staging* directory (i.e.
 * the flat Shopify-shaped output) — never from `src/`.
 *
 * What we resolve:
 *   - `templates/<name>.json`        — JSON template, parse `sections` map.
 *   - `templates/<name>.liquid`      — Liquid template, regex-scan for
 *     `{% section 'x' %}` and `{% sections 'group' %}`.
 *   - `sections/<group>.json`        — Online Store 2.0 section group,
 *     referenced via `{% sections '<group>' %}` (or analogous block in a
 *     JSON template's metadata — Shopify supports both).
 *
 * What we don't resolve (out of scope for Phase 5-lite):
 *   - `templates/<name>.<suffix>.json` and `.<suffix>.liquid` variants.
 *     Suffix templates are listed alongside the base; budgets apply to
 *     each one independently.
 *   - Conditional sections inside blocks (we count blocks' parent section
 *     once; nested-block resolution is a Phase 7 LSP concern).
 *   - App blocks (their JS isn't part of our build).
 */
export interface ResolvedTemplate {
  /** Template handle without extension. `index`, `product`, `404`, etc. */
  readonly handle: string;
  /** Section types (matching `sections/<type>/index.liquid` directories). */
  readonly sectionTypes: ReadonlyArray<string>;
}

export interface ResolveTemplateTreeOptions {
  /** Path to the staging dir (e.g. `<project>/.alambic/theme`). */
  themeDir: string;
}

export async function resolveTemplateTree(
  opts: ResolveTemplateTreeOptions,
): Promise<ReadonlyArray<ResolvedTemplate>> {
  const templatesDir = join(opts.themeDir, 'templates');
  const sectionGroupsDir = join(opts.themeDir, 'sections');

  const entries = await safeReaddir(templatesDir);
  const templates: ResolvedTemplate[] = [];

  for (const file of entries) {
    if (file.startsWith('.')) continue;
    const handle = stripTemplateExtension(file);
    if (!handle) continue;

    const path = join(templatesDir, file);
    let types: string[] = [];
    let groupRefs: string[] = [];

    if (file.endsWith('.json')) {
      ({ types, groupRefs } = await parseJsonTemplate(path));
    } else if (file.endsWith('.liquid')) {
      ({ types, groupRefs } = await parseLiquidTemplate(path));
    } else {
      continue;
    }

    // Each referenced section group is itself a JSON file under
    // `sections/<group>.json`. Resolve its section types and merge.
    for (const group of groupRefs) {
      const groupPath = join(sectionGroupsDir, `${group}.json`);
      try {
        const text = await readFile(groupPath, 'utf8');
        const parsed = JSON.parse(text) as { sections?: Record<string, { type?: string }> };
        for (const ref of Object.values(parsed.sections ?? {})) {
          if (typeof ref.type === 'string') types.push(ref.type);
        }
      } catch {
        // Group file missing — skip silently; the resolver isn't a
        // validator. Validation belongs to `alambic schema check`.
      }
    }

    templates.push({ handle, sectionTypes: dedupe(types) });
  }

  templates.sort((a, b) => a.handle.localeCompare(b.handle));
  return templates;
}

async function parseJsonTemplate(path: string): Promise<{ types: string[]; groupRefs: string[] }> {
  try {
    const text = await readFile(path, 'utf8');
    const parsed = JSON.parse(text) as {
      sections?: Record<string, { type?: string }>;
    };
    const types: string[] = [];
    for (const ref of Object.values(parsed.sections ?? {})) {
      if (typeof ref.type === 'string') types.push(ref.type);
    }
    return { types, groupRefs: [] };
  } catch {
    return { types: [], groupRefs: [] };
  }
}

const SECTION_TAG = /\{%-?\s*section\s+['"]([^'"]+)['"]\s*-?%\}/g;
const SECTIONS_TAG = /\{%-?\s*sections\s+['"]([^'"]+)['"]\s*-?%\}/g;

async function parseLiquidTemplate(
  path: string,
): Promise<{ types: string[]; groupRefs: string[] }> {
  try {
    const source = await readFile(path, 'utf8');
    const types: string[] = [];
    const groupRefs: string[] = [];
    for (const m of source.matchAll(SECTION_TAG)) {
      if (m[1]) types.push(m[1]);
    }
    for (const m of source.matchAll(SECTIONS_TAG)) {
      if (m[1]) groupRefs.push(m[1]);
    }
    return { types, groupRefs };
  } catch {
    return { types: [], groupRefs: [] };
  }
}

function stripTemplateExtension(file: string): string | null {
  if (file.endsWith('.json')) return file.slice(0, -'.json'.length);
  if (file.endsWith('.liquid')) return file.slice(0, -'.liquid'.length);
  return null;
}

function dedupe<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}
