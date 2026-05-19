import { applyEnvFiles, resolveConfig } from '@alambic/core';
import { loadConfig } from '../../../internal/load-config.js';
import type { Check, CheckResult } from '../types.js';

/**
 * Verify the active environment's store/themeId resolve. We don't actually
 * call Shopify — just confirm that the env files + config produce concrete
 * strings for the active env (so `alambic dev` would have what it needs).
 */
export const environmentCheck: Check = async (ctx) => {
  if (!ctx.hasConfig) return [];

  applyEnvFiles(ctx.cwd, null);
  const { config, cwd } = await loadConfig(ctx.cwd).catch(() => ({ config: null, cwd: ctx.cwd }));
  if (!config) return [];

  const envCount = Object.keys(config.environments ?? {}).length;
  if (envCount === 0) {
    return [
      {
        group: 'Environments',
        name: 'environments',
        severity: 'warn',
        message: 'No environments defined.',
        hint: 'Add `environments` + `defaultEnvironment` to alambic.config.ts to enable `alambic dev`/`push`.',
      },
    ];
  }

  const activeName = config.defaultEnvironment ?? null;
  if (!activeName) {
    return [
      {
        group: 'Environments',
        name: 'defaultEnvironment',
        severity: 'warn',
        message: `${envCount} environment(s) defined but no defaultEnvironment.`,
        hint: 'Set `defaultEnvironment: "dev"` (or pass --env on the CLI).',
      },
    ];
  }

  applyEnvFiles(cwd, activeName);
  const resolved = resolveConfig({ ...config, activeEnvironmentName: activeName } as never, cwd);
  const results: CheckResult[] = [];

  if (!resolved.activeEnvironment.store) {
    results.push({
      group: 'Environments',
      name: `${activeName}.store`,
      severity: 'fail',
      message: `Active environment "${activeName}" has no resolved \`store\`.`,
      hint: `Set the variable referenced by environments.${activeName}.store in .env.${activeName}.local or .env.local.`,
    });
  } else {
    results.push({
      group: 'Environments',
      name: `${activeName}.store`,
      severity: 'pass',
      message: resolved.activeEnvironment.store,
    });
  }

  if (!resolved.activeEnvironment.themeId) {
    results.push({
      group: 'Environments',
      name: `${activeName}.themeId`,
      severity: 'warn',
      message: 'No themeId — Shopify CLI will create a hidden dev theme on first run.',
    });
  } else {
    results.push({
      group: 'Environments',
      name: `${activeName}.themeId`,
      severity: 'pass',
      message: resolved.activeEnvironment.themeId,
    });
  }

  return results;
};
