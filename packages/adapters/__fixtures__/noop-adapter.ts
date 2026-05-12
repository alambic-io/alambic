import {
  type CompiledSection,
  type CssAdapter,
  type JsAdapter,
  type Preset,
  type ThemeSettings,
  defineCssAdapter,
  defineJsAdapter,
  definePreset,
} from '../src/index.js';

/**
 * A no-op preset that implements every contract method as the simplest
 * valid stub. Used as a sanity check that the contracts compile and that
 * the `define*` helpers preserve types.
 */

const noopCss: CssAdapter = defineCssAdapter({
  name: 'noop-css',
  vitePlugins: () => [],
  contentSources: () => [],
  emitTokens: (_settings: ThemeSettings) => '',
  extractCritical: (_html, _fullCss) => '',
});

const noopJs: JsAdapter = defineJsAdapter({
  name: 'noop-js',
  vitePlugins: () => [],
  discoverEntries: () => [],
  hydrationRuntime: '',
  generateComponentBindings: (_section: CompiledSection) => '',
});

export const noopPreset: Preset = definePreset({
  name: 'noop',
  css: noopCss,
  js: noopJs,
});
