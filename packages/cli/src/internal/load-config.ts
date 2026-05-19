import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AlambicError, type AlambicConfig } from '@alambic/core';

const CONFIG_FILENAMES = ['alambic.config.ts', 'alambic.config.mjs', 'alambic.config.js'] as const;

export interface LoadedConfig {
  config: AlambicConfig;
  /** Absolute path to the config file that was loaded. */
  path: string;
  /** Directory containing the config file — used as the resolution base. */
  cwd: string;
}

export async function loadConfig(cwd: string, override?: string): Promise<LoadedConfig> {
  const path = override ? resolve(cwd, override) : findConfigFile(cwd);
  if (!path) {
    throw new AlambicError({
      code: 'ALAMBIC_CONFIG_NOT_FOUND',
      message: `No alambic.config.{ts,mjs,js} found in ${cwd}`,
      hint: 'Create one or pass --config <path>',
    });
  }

  const url = pathToFileURL(path).href;
  let mod: { default?: unknown };
  try {
    mod = (await import(url)) as { default?: unknown };
  } catch (cause) {
    throw new AlambicError({
      code: 'ALAMBIC_CONFIG_LOAD_FAILED',
      message: `Failed to load ${path}`,
      cause,
    });
  }
  const config = (mod.default ?? mod) as AlambicConfig;
  if (!config || typeof config !== 'object') {
    throw new AlambicError({
      code: 'ALAMBIC_CONFIG_INVALID',
      message: `Default export of ${path} is not an object`,
      hint: 'Use `export default defineConfig({ ... })`',
    });
  }
  return { config, path, cwd: resolve(path, '..') };
}

function findConfigFile(cwd: string): string | null {
  for (const name of CONFIG_FILENAMES) {
    const candidate = resolve(cwd, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
