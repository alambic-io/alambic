import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveConfig } from '@alambic/core';
import { loadConfig } from '../../../internal/load-config.js';
import type { Check } from '../types.js';

const CONFIG_CANDIDATES = ['alambic.config.ts', 'alambic.config.mjs', 'alambic.config.js'];

export const configCheck: Check = async (ctx) => {
  const found = CONFIG_CANDIDATES.map((f) => resolve(ctx.cwd, f)).find((p) => existsSync(p));
  if (!found) {
    return [
      {
        group: 'Config',
        name: 'alambic.config.ts',
        severity: 'warn' as const,
        message: 'No alambic.config.{ts,mjs,js} in current directory.',
        hint:
          'If this is a consumer theme, scaffold one via `pnpm create alambic`. ' +
          'If this is the alambic monorepo, the check is informational.',
      },
    ];
  }
  try {
    const { config, cwd } = await loadConfig(ctx.cwd);
    const resolved = resolveConfig(config, cwd);
    const envCount = Object.keys(config.environments ?? {}).length;
    const envSuffix =
      envCount > 0
        ? `, ${envCount} environment${envCount === 1 ? '' : 's'}${
            resolved.activeEnvironmentName ? ` (active: ${resolved.activeEnvironmentName})` : ''
          }`
        : '';
    return [
      {
        group: 'Config',
        name: 'alambic.config.ts',
        severity: 'pass' as const,
        message: `Loaded${envSuffix}.`,
      },
    ];
  } catch (err) {
    return [
      {
        group: 'Config',
        name: 'alambic.config.ts',
        severity: 'fail' as const,
        message: `Failed to load: ${(err as Error).message}`,
      },
    ];
  }
};
