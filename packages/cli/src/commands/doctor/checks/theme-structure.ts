import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { resolveConfig } from '@alambic/core';
import { loadConfig } from '../../../internal/load-config.js';
import type { Check, CheckResult } from '../types.js';

/** Directories Shopify recognizes inside a theme. */
const REQUIRED_DIRS = ['layout', 'sections', 'templates', 'config'] as const;
const OPTIONAL_DIRS = ['snippets', 'locales', 'blocks', 'assets'] as const;

export const themeStructureCheck: Check = async (ctx) => {
  if (!ctx.hasConfig) {
    return [];
  }
  const { config, cwd } = await loadConfig(ctx.cwd).catch(() => ({ config: null, cwd: ctx.cwd }));
  if (!config) return [];

  const resolved = resolveConfig(config, cwd);
  const root = resolved.themeRoot;
  const results: CheckResult[] = [];

  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return [
      {
        group: 'Theme',
        name: 'themeRoot',
        severity: 'fail',
        message: `Theme root ${root} does not exist.`,
        hint: 'Check `themeRoot` in alambic.config.ts.',
      },
    ];
  }

  const missingRequired: string[] = [];
  for (const dir of REQUIRED_DIRS) {
    const full = join(root, dir);
    if (!existsSync(full) || !statSync(full).isDirectory()) {
      missingRequired.push(dir);
    }
  }
  if (missingRequired.length > 0) {
    results.push({
      group: 'Theme',
      name: 'Required directories',
      severity: 'fail',
      message: `Missing under ${root}: ${missingRequired.join(', ')}.`,
      hint: 'A Shopify theme needs at least: layout/, sections/, templates/, config/.',
    });
  } else {
    results.push({
      group: 'Theme',
      name: 'Required directories',
      severity: 'pass',
      message: `layout/, sections/, templates/, config/ all present.`,
    });
  }

  const presentOptional = OPTIONAL_DIRS.filter(
    (d) => existsSync(join(root, d)) && statSync(join(root, d)).isDirectory(),
  );
  if (presentOptional.length > 0) {
    results.push({
      group: 'Theme',
      name: 'Optional directories',
      severity: 'pass',
      message: `Found: ${presentOptional.join(', ')}.`,
    });
  }

  // layout/theme.liquid is effectively required for any storefront page.
  const themeLiquid = join(root, 'layout', 'theme.liquid');
  if (!existsSync(themeLiquid)) {
    results.push({
      group: 'Theme',
      name: 'layout/theme.liquid',
      severity: 'warn',
      message: 'No layout/theme.liquid found — most pages will fail to render.',
    });
  }

  return results;
};
