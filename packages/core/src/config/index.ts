import { resolve } from 'node:path';
import { AlambicError } from '../errors/index.js';
import type { AlambicConfig, ResolvedAlambicConfig } from '../types.js';

/**
 * Identity-with-types helper for `alambic.config.ts`.
 *
 * ```ts
 * import { defineConfig } from '@alambic/core';
 * import { tailwindAlpine } from '@alambic/preset-tailwind-alpine';
 *
 * export default defineConfig({
 *   preset: tailwindAlpine(),
 *   themeRoot: './src',
 *   output: './dist/theme',
 * });
 * ```
 */
export function defineConfig(config: AlambicConfig): AlambicConfig {
  return config;
}

const DEFAULTS = {
  themeRoot: './src',
  output: './dist/theme',
  vitePort: 5173,
  shopifyPort: 9292,
} as const;

/**
 * Apply defaults and surface invariant violations as `AlambicError`s.
 *
 * `cwd` is the directory the config file lives in. Relative paths in the
 * user config are resolved against it.
 */
export function resolveConfig(input: AlambicConfig, cwd: string): ResolvedAlambicConfig {
  if (input.preset && (input.css || input.js)) {
    throw new AlambicError({
      code: 'ALAMBIC_CONFIG_PRESET_OR_ADAPTERS',
      message: 'Provide `preset`, or `css`+`js`, but not both',
      hint: 'Pick one: `preset: tailwindAlpine()` or `css: ..., js: ...`',
    });
  }

  const preset = input.preset ?? null;
  const css = preset ? preset.css : (input.css ?? null);
  const js = preset ? preset.js : (input.js ?? null);

  return {
    themeRoot: resolve(cwd, input.themeRoot ?? DEFAULTS.themeRoot),
    output: resolve(cwd, input.output ?? DEFAULTS.output),
    preset,
    css,
    js,
    dev: {
      vitePort: input.dev?.vitePort ?? DEFAULTS.vitePort,
      shopifyPort: input.dev?.shopifyPort ?? DEFAULTS.shopifyPort,
      spawnShopifyCli: input.dev?.spawnShopifyCli ?? true,
      shopifyCliArgs: input.dev?.shopifyCliArgs ?? [],
    },
  };
}
