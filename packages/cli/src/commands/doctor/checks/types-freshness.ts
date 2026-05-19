import { existsSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveConfig } from '@alambic/core';
import { loadConfig } from '../../../internal/load-config.js';
import type { Check } from '../types.js';

/**
 * `.alambic/types/index.d.ts` should be at least as fresh as the most
 * recent `schema.ts` under sections/ or blocks/. If it's older, the
 * generated types may be stale.
 */
export const typesFreshnessCheck: Check = async (ctx) => {
  if (!ctx.hasConfig) return [];

  const { config, cwd } = await loadConfig(ctx.cwd).catch(() => ({ config: null, cwd: ctx.cwd }));
  if (!config) return [];

  const resolved = resolveConfig(config, cwd);
  const typesFile = join(cwd, '.alambic', 'types', 'index.d.ts');

  const schemaFiles = await collectSchemaFiles(resolved.themeRoot);
  if (schemaFiles.length === 0) return [];

  if (!existsSync(typesFile)) {
    return [
      {
        group: 'Types',
        name: '.alambic/types/index.d.ts',
        severity: 'warn',
        message: `Not generated yet (${schemaFiles.length} schema.ts file(s) found).`,
        hint: 'Run `alambic types` to generate.',
      },
    ];
  }

  const typesMtime = statSync(typesFile).mtimeMs;
  const stale = schemaFiles.filter((f) => statSync(f).mtimeMs > typesMtime);
  if (stale.length > 0) {
    const newest = Math.max(...stale.map((f) => statSync(f).mtimeMs));
    const delta = Math.round((newest - typesMtime) / 1000);
    return [
      {
        group: 'Types',
        name: '.alambic/types/index.d.ts',
        severity: 'warn',
        message: `Stale by ~${delta}s (${stale.length} schema file${stale.length === 1 ? '' : 's'} newer).`,
        hint: 'Run `alambic types` to regenerate.',
      },
    ];
  }

  return [
    {
      group: 'Types',
      name: '.alambic/types/index.d.ts',
      severity: 'pass',
      message: `Fresh (vs. ${schemaFiles.length} schema file${schemaFiles.length === 1 ? '' : 's'}).`,
    },
  ];
};

async function collectSchemaFiles(themeRoot: string): Promise<string[]> {
  const results: string[] = [];
  for (const dir of ['sections', 'blocks']) {
    const root = join(themeRoot, dir);
    if (!existsSync(root)) continue;
    let entries: string[];
    try {
      entries = await readdir(root);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const schemaPath = join(root, entry, 'schema.ts');
      if (existsSync(schemaPath)) results.push(schemaPath);
    }
  }
  return results;
}
