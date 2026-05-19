/**
 * Detects sections (and theme blocks) that declare a schema in **two**
 * places at once:
 *
 *   sections/<name>/schema.ts   AND
 *   sections/<name>/index.liquid containing `{% schema %} ... {% endschema %}`
 *
 * During staging, `@alambic/schema` compiles `schema.ts` and inlines it
 * into the staged Liquid. If the source `index.liquid` already has a
 * `{% schema %}` block, the inliner *replaces* it with the compiled
 * output — silently. The author may believe they're editing the schema
 * inline while changes are being thrown away.
 *
 * We flag the conflict as a warning. The fix is to pick one source of
 * truth: keep `schema.ts` (canonical) and delete the inline block.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { resolveConfig } from '@alambic/core';
import { loadConfig } from '../../../internal/load-config.js';
import type { Check, CheckResult } from '../types.js';

const SCHEMA_BLOCK = /\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/;

export const schemaSourceCheck: Check = async (ctx) => {
  if (!ctx.hasConfig) return [];
  const loaded = await loadConfig(ctx.cwd).catch(() => null);
  if (!loaded) return [];
  const resolved = resolveConfig(loaded.config, loaded.cwd);
  const root = resolved.themeRoot;
  if (!existsSync(root)) return [];

  const conflicts: string[] = [];

  for (const kind of ['sections', 'blocks'] as const) {
    const dir = join(root, kind);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    for (const entry of readdirSync(dir)) {
      const folder = join(dir, entry);
      if (!statSync(folder).isDirectory()) continue;
      const schemaTs = join(folder, 'schema.ts');
      const indexLiquid = join(folder, 'index.liquid');
      if (!existsSync(schemaTs) || !existsSync(indexLiquid)) continue;
      const liquid = readFileSync(indexLiquid, 'utf8');
      if (SCHEMA_BLOCK.test(liquid)) {
        conflicts.push(`${kind}/${entry}`);
      }
    }
  }

  const results: CheckResult[] = [];
  if (conflicts.length === 0) {
    results.push({
      group: 'Schema sources',
      name: 'No conflicts',
      severity: 'pass',
      message: 'Every section/block declares its schema in exactly one place.',
    });
  } else {
    results.push({
      group: 'Schema sources',
      name: 'Conflicting schema declarations',
      severity: 'warn',
      message: `Has both schema.ts and inline {% schema %}: ${conflicts.join(', ')}.`,
      hint: 'Keep `schema.ts` (the inliner overwrites the inline block during staging) and remove `{% schema %}…{% endschema %}` from index.liquid.',
    });
  }

  return results;
};
