import { resolve } from 'node:path';
import { resolveEnvironment } from '../env/index.js';
import { AlambicError } from '../errors/index.js';
import type { AlambicConfig, AlambicPluginOptions, ResolvedAlambicConfig } from '../types.js';

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
  // Shared between `alambic dev` (live-synced staging) and `alambic build`
  // (one-shot output). Hidden + gitignored by convention.
  output: './.alambic/theme',
  vitePort: 5173,
  shopifyPort: 9292,
} as const;

/**
 * Apply defaults and surface invariant violations as `AlambicError`s.
 *
 * `cwd` is the directory the config file lives in. Relative paths in the
 * user config are resolved against it.
 *
 * Environment resolution: if `input` is an `AlambicPluginOptions` with an
 * `activeEnvironmentName`, that takes precedence; otherwise `defaultEnvironment`
 * is used. If neither is set, no environment is active and Shopify CLI flags
 * are not modified.
 */
export function resolveConfig(
  input: AlambicConfig | AlambicPluginOptions,
  cwd: string,
): ResolvedAlambicConfig {
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

  const activeName = pickEnvironmentName(input);
  if (activeName !== null && !input.environments?.[activeName]) {
    throw new AlambicError({
      code: 'ALAMBIC_ENV_UNKNOWN',
      message: `Unknown environment "${activeName}"`,
      hint: input.environments
        ? `Available: ${Object.keys(input.environments).join(', ')}`
        : 'Define `environments: { ... }` in alambic.config.ts',
    });
  }

  const activeEnvironment = resolveEnvironment(
    activeName !== null ? input.environments?.[activeName] : undefined,
  );

  // `ALAMBIC_THEME_ROOT` is set by the CLI's `--theme-root <path>` flag.
  // Flag > config > default — the convention is that an explicit CLI
  // override wins over an `alambic.config.ts` value.
  const themeRootOverride = process.env['ALAMBIC_THEME_ROOT'];
  const themeRoot = themeRootOverride ?? input.themeRoot ?? DEFAULTS.themeRoot;

  return {
    themeRoot: resolve(cwd, themeRoot),
    output: resolve(cwd, input.output ?? DEFAULTS.output),
    preset,
    css,
    js,
    budgets: input.budgets ?? null,
    dev: {
      vitePort: input.dev?.vitePort ?? DEFAULTS.vitePort,
      shopifyPort: input.dev?.shopifyPort ?? DEFAULTS.shopifyPort,
      spawnShopifyCli: input.dev?.spawnShopifyCli ?? true,
      openInBrowser: input.dev?.openInBrowser ?? true,
      shopifyCliArgs: input.dev?.shopifyCliArgs ?? [],
    },
    activeEnvironmentName: activeName,
    activeEnvironment,
  };
}

function pickEnvironmentName(input: AlambicConfig | AlambicPluginOptions): string | null {
  const plugin = input as AlambicPluginOptions;
  if (plugin.activeEnvironmentName) return plugin.activeEnvironmentName;
  if (input.defaultEnvironment) return input.defaultEnvironment;
  return null;
}
