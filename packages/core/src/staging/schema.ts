/**
 * Resolve and apply `schema.ts` files co-located with sections and theme
 * blocks. When a `src/sections/<name>/schema.ts` exists, alambic imports
 * it (via jiti), compiles the exported SectionDefinition to Shopify JSON,
 * and rewrites the corresponding `.alambic/theme/sections/<name>.liquid`
 * with the schema inlined.
 *
 * Same for theme blocks under `blocks/<name>/schema.ts`.
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  compileSection,
  compileThemeBlock,
  formatIssue,
  hasErrors,
  inlineSchema,
  stringifySchema,
  validateSection,
  validateThemeBlock,
  type SectionDefinition,
  type ThemeBlockDefinition,
} from '@alambic/schema';
import { createJiti, type Jiti } from 'jiti';
import { AlambicError } from '../errors/index.js';
import type { Logger } from '../logger/index.js';

let jiti: Jiti | null = null;

function getJiti(themeRoot: string): Jiti {
  // One jiti per process; reset its cache between runs via fresh: true.
  if (!jiti) {
    jiti = createJiti(themeRoot, { fsCache: false, moduleCache: false });
  }
  return jiti;
}

export interface ApplySchemaResult {
  /** True when a schema.ts existed and was applied. */
  applied: boolean;
  /** Path of the schema.ts file that was applied. Null if no sibling existed. */
  schemaSource: string | null;
}

/**
 * Given a destination liquid file (already copied to staging), look for a
 * sibling `schema.ts` in the SOURCE tree and inline its compiled output.
 *
 * `sourceRel` is the path relative to themeRoot, in POSIX form, e.g.
 * `sections/hero/index.liquid` or `blocks/badge/index.liquid`.
 *
 * Returns `applied: false` quickly when there's no schema sibling.
 */
export async function applySchema(args: {
  themeRoot: string;
  outputRoot: string;
  /** Source path relative to themeRoot (POSIX `/`). */
  sourceRel: string;
  /** Destination path relative to outputRoot (POSIX `/`). */
  destRel: string;
  logger?: Logger;
}): Promise<ApplySchemaResult> {
  const kind = detectKind(args.sourceRel);
  if (!kind) return { applied: false, schemaSource: null };

  const sourceAbs = join(args.themeRoot, args.sourceRel);
  const schemaPath = join(dirname(sourceAbs), 'schema.ts');
  if (!existsSync(schemaPath)) {
    return { applied: false, schemaSource: null };
  }

  const j = getJiti(args.themeRoot);
  // Bust the cache so dev-mode edits to schema.ts re-evaluate every time.
  try {
    const cache = j.cache as Record<string, unknown> | undefined;
    if (cache) delete cache[schemaPath];
  } catch {
    // jiti cache API isn't part of its public contract; tolerate shape changes.
  }

  let mod: { default?: unknown };
  try {
    mod = (await j.import(schemaPath)) as { default?: unknown };
  } catch (cause) {
    throw new AlambicError({
      code: 'ALAMBIC_SCHEMA_LOAD_FAILED',
      message: `Failed to load ${schemaPath}`,
      cause,
    });
  }
  const def = (mod.default ?? mod) as unknown;
  if (!def || typeof def !== 'object') {
    throw new AlambicError({
      code: 'ALAMBIC_SCHEMA_INVALID_EXPORT',
      message: `${schemaPath} must default-export a section() or themeBlock() definition`,
    });
  }

  // Validate, then compile.
  const body = compileAndStringify(def as SectionDefinition | ThemeBlockDefinition, kind);

  // Re-read + inline. The destination file was just copied by the staging
  // step; we overwrite it with the schema-aware version.
  const destAbs = join(args.outputRoot, args.destRel);
  const liquid = await readFile(destAbs, 'utf8');
  const updated = inlineSchema(liquid, { body });
  await writeFile(destAbs, updated, 'utf8');

  args.logger?.debug(`schema: ${args.sourceRel} (${kind}) → ${args.destRel}`);
  return { applied: true, schemaSource: schemaPath };
}

function detectKind(sourceRel: string): 'section' | 'theme-block' | null {
  if (/^sections\/[^/]+\/index\.liquid$/.test(sourceRel)) return 'section';
  if (/^blocks\/[^/]+\/index\.liquid$/.test(sourceRel)) return 'theme-block';
  return null;
}

function compileAndStringify(
  def: SectionDefinition | ThemeBlockDefinition,
  kind: 'section' | 'theme-block',
): string {
  if (kind === 'section') {
    const sec = def as SectionDefinition;
    const issues = validateSection(sec);
    if (hasErrors(issues)) {
      throw new AlambicError({
        code: 'ALAMBIC_SCHEMA_INVALID',
        message: `Schema validation failed:\n${issues.map(formatIssue).join('\n')}`,
      });
    }
    return stringifySchema(compileSection(sec));
  }
  const block = def as ThemeBlockDefinition;
  const issues = validateThemeBlock(block);
  if (hasErrors(issues)) {
    throw new AlambicError({
      code: 'ALAMBIC_SCHEMA_INVALID',
      message: `Schema validation failed:\n${issues.map(formatIssue).join('\n')}`,
    });
  }
  return stringifySchema(compileThemeBlock(block));
}
