import type { CssAdapter, JsAdapter, Preset } from './contracts.js';

/**
 * Identity-with-types helpers. Zero runtime cost — they exist purely so
 * adapter authors get editor inference and a clear, named call site.
 */

export function defineCssAdapter(adapter: CssAdapter): CssAdapter {
  return adapter;
}

export function defineJsAdapter(adapter: JsAdapter): JsAdapter {
  return adapter;
}

export function definePreset(preset: Preset): Preset {
  return preset;
}
