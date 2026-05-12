import type { CssAdapter, JsAdapter, Preset } from '@alambic/adapters';

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
}
