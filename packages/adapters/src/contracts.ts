import type { Plugin } from 'vite';
import type { AdapterContext, CompiledSection, EntryPoint, ThemeSettings } from './types.js';

/**
 * A CSS engine adapter (e.g. Tailwind v4, UnoCSS, vanilla extract).
 *
 * Implementers return Vite plugins, declare content sources to scan,
 * emit token CSS from theme settings, and extract critical CSS for a
 * given template HTML.
 */
export interface CssAdapter {
  readonly name: string;

  /** Vite plugins to inject for CSS processing. Called once during Vite config setup. */
  vitePlugins(ctx: AdapterContext): Plugin[];

  /** File globs (relative to themeRoot) to scan for class names / utility usage. */
  contentSources(ctx: AdapterContext): string[];

  /**
   * Convert theme settings (settings_data.json) into a CSS variable block.
   * Called at build, and on settings changes during dev.
   */
  emitTokens(settings: ThemeSettings): string;

  /**
   * Critical CSS extraction. Receives the rendered template HTML and the
   * full CSS bundle; returns the critical subset to inline.
   */
  extractCritical(html: string, fullCss: string): string;
}

/**
 * A JS runtime adapter (e.g. Alpine, Stimulus, HTMX).
 *
 * Implementers return Vite plugins, discover client entry points,
 * provide a hydration runtime, and generate component bindings from
 * compiled section definitions.
 */
export interface JsAdapter {
  readonly name: string;

  vitePlugins(ctx: AdapterContext): Plugin[];

  /** Discover client entries. Default convention is `sections/<name>/client.ts`. */
  discoverEntries(ctx: AdapterContext): EntryPoint[];

  /** Absolute path to the prebuilt hydration runtime that the consumer ships. */
  readonly hydrationRuntime: string;

  /** Bridge between Alambic's typed schemas and this adapter's component model. */
  generateComponentBindings(section: CompiledSection): string;
}

/**
 * A complete preset bundles a CssAdapter and a JsAdapter and gives them a name.
 *
 * `@alambic/preset-tailwind-alpine` is the reference implementation.
 */
export interface Preset {
  readonly name: string;
  readonly css: CssAdapter;
  readonly js: JsAdapter;
}
