import type { CssAdapter, JsAdapter, Preset } from '@alambic/adapters';
import type { Environment, ResolvedEnvironment } from './env/index.js';

/**
 * User-facing configuration shape, authored in `alambic.config.ts`.
 */
export interface AlambicConfig {
  /**
   * Theme source root. Defaults to `./src` relative to the config file.
   */
  themeRoot?: string;

  /**
   * Build output directory. Defaults to `./dist/theme`.
   */
  output?: string;

  /**
   * A complete preset, OR explicit `css` + `js` adapters.
   */
  preset?: Preset;
  css?: CssAdapter;
  js?: JsAdapter;

  /**
   * Named target environments — typically `dev`, `preprod`, `prod`.
   *
   * Each environment maps to a Shopify store + theme combination. Use
   * `env('SHOPIFY_DEV_STORE')` to defer resolution to `.env.[name][.local]`
   * files, which are loaded before this config is consulted.
   *
   * The active environment is selected by:
   *   1. The `--env <name>` CLI flag (if given), or
   *   2. `defaultEnvironment` (if set), or
   *   3. None (no Shopify CLI flags appended).
   */
  environments?: Record<string, Environment>;

  /**
   * Default environment name used when `--env` is not passed on the CLI.
   * Must be a literal string (not env()-derived) so it can be read before
   * env-specific files are loaded.
   */
  defaultEnvironment?: string;

  /**
   * Optional dev-mode overrides.
   */
  dev?: {
    /** Port for the Vite dev server. Default: 5173. */
    vitePort?: number;
    /** Port for `shopify theme dev`. Default: 9292 (Shopify CLI default). */
    shopifyPort?: number;
    /** Whether to spawn `shopify theme dev` automatically. Default: true. */
    spawnShopifyCli?: boolean;
    /** Extra arguments passed to `shopify theme dev`. */
    shopifyCliArgs?: string[];
  };
}

/**
 * Vite plugin options accepted by `alambic()`. In normal use you pass
 * an `AlambicConfig` directly — this type is what the resolver returns
 * after defaults are applied.
 */
export interface AlambicPluginOptions extends AlambicConfig {
  /**
   * Skip spawning `shopify theme dev`. Useful for tests and CI builds.
   */
  noShopifyCli?: boolean;
  /**
   * Active environment name. Set by the CLI based on `--env <name>`. When
   * absent, the plugin falls back to `defaultEnvironment`.
   */
  activeEnvironmentName?: string;
}

export interface ResolvedAlambicConfig {
  themeRoot: string;
  output: string;
  preset: Preset | null;
  css: CssAdapter | null;
  js: JsAdapter | null;
  dev: {
    vitePort: number;
    shopifyPort: number;
    spawnShopifyCli: boolean;
    shopifyCliArgs: ReadonlyArray<string>;
  };
  /** The name of the active environment, if one is in effect. */
  activeEnvironmentName: string | null;
  /** Resolved store/theme/password for the active environment. */
  activeEnvironment: ResolvedEnvironment;
}
