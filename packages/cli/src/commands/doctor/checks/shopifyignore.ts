/**
 * Warn if there's no `.shopifyignore` in the theme root.
 *
 * Without one, `shopify theme push` happily overwrites merchant-edited
 * `templates/*.json`, `config/settings_data.json`, and section groups —
 * exactly the files the merchant owns via the theme editor. Almost
 * always a bug.
 *
 * The default scaffold (via `create-alambic`) ships a sensible
 * `.shopifyignore` covering those paths. This check exists for themes
 * brought in from outside the scaffolder.
 *
 * Skipped silently when there's no `alambic.config.*` (monorepo-root
 * case), and when the theme has no merchant-editable JSON yet
 * (`templates/*.json` count = 0 — typically a brand-new scaffold).
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { resolveConfig } from '@alambic/core';
import { loadConfig } from '../../../internal/load-config.js';
import type { Check, CheckResult } from '../types.js';

export const shopifyignoreCheck: Check = async (ctx) => {
  if (!ctx.hasConfig) return [];
  const loaded = await loadConfig(ctx.cwd).catch(() => null);
  if (!loaded) return [];
  const resolved = resolveConfig(loaded.config, loaded.cwd);
  const themeRoot = resolved.themeRoot;
  if (!existsSync(themeRoot)) return [];

  const ignorePath = join(themeRoot, '.shopifyignore');
  if (existsSync(ignorePath)) {
    return [
      {
        group: 'Shopifyignore',
        name: '.shopifyignore',
        severity: 'pass',
        message: 'Found — merchant-owned paths are protected on push.',
      },
    ];
  }

  // No `.shopifyignore` — but is there anything merchant-editable to
  // protect yet? A brand-new project has no templates, so warning would
  // be noise. We check the templates dir for *.json.
  const templatesDir = join(themeRoot, 'templates');
  let hasMerchantOwnedFiles = false;
  if (existsSync(templatesDir) && statSync(templatesDir).isDirectory()) {
    hasMerchantOwnedFiles = readdirSync(templatesDir).some((f) => f.endsWith('.json'));
  }
  if (!hasMerchantOwnedFiles) {
    return [
      {
        group: 'Shopifyignore',
        name: '.shopifyignore',
        severity: 'pass',
        message: 'Not needed yet (no merchant-editable JSON in templates/).',
      },
    ];
  }

  const results: CheckResult[] = [
    {
      group: 'Shopifyignore',
      name: '.shopifyignore',
      severity: 'warn',
      message: `No .shopifyignore in ${themeRoot}.`,
      hint: 'Create src/.shopifyignore with `templates/*.json`, `config/settings_data.json`, and `sections/*.json` to keep `alambic push` from overwriting merchant edits.',
    },
  ];
  return results;
};
