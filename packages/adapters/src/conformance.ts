/**
 * Adapter conformance suite.
 *
 * Every CSS / JS adapter implementation must pass the structural checks
 * exported from this module. Presets wire them into their own Vitest
 * test files so a regression in `@alambic/preset-tailwind-alpine` (or
 * any third-party adapter) is caught locally.
 *
 * Usage in a preset:
 *
 *   import { describe, test, expect } from 'vitest';
 *   import { cssAdapterCases, jsAdapterCases, makeStubContext } from '@alambic/adapters/conformance';
 *   import { tailwindAlpine } from '../src/preset';
 *
 *   describe('tailwindAlpine conformance', () => {
 *     const preset = tailwindAlpine();
 *     const ctx = makeStubContext({ themeRoot: '/tmp/theme' });
 *     for (const c of cssAdapterCases) {
 *       test(`css/${c.name}`, () => c.run(preset.css, ctx));
 *     }
 *     for (const c of jsAdapterCases) {
 *       test(`js/${c.name}`, () => c.run(preset.js, ctx));
 *     }
 *   });
 *
 * The conformance functions throw on failure with a descriptive
 * message. Vitest's `test()` catches the throw and reports it.
 */
import type { CssAdapter, JsAdapter } from './contracts.js';
import type { AdapterContext, Logger } from './types.js';

export interface ConformanceCase<TAdapter> {
  readonly name: string;
  readonly run: (adapter: TAdapter, ctx: AdapterContext) => void | Promise<void>;
}

/** A minimal logger that swallows every level — fine for conformance tests. */
function noopLogger(): Logger {
  return {
    error: () => undefined,
    warn: () => undefined,
    info: () => undefined,
    debug: () => undefined,
  };
}

/**
 * Build an `AdapterContext` suitable for running conformance cases.
 * Callers can override any field (e.g. to give a more realistic
 * `themeRoot` so the adapter's content globs match real files).
 */
export function makeStubContext(overrides: Partial<AdapterContext> = {}): AdapterContext {
  return {
    mode: 'build',
    themeRoot: '/tmp/conformance-theme',
    outputRoot: '/tmp/conformance-out',
    sections: [],
    settings: {},
    logger: noopLogger(),
    ...overrides,
  };
}

function fail(msg: string): never {
  throw new Error(msg);
}

export const cssAdapterCases: ReadonlyArray<ConformanceCase<CssAdapter>> = [
  {
    name: 'exposes a non-empty `name`',
    run: (a) => {
      if (typeof a.name !== 'string' || a.name.length === 0) {
        fail('CssAdapter.name must be a non-empty string');
      }
    },
  },
  {
    name: 'vitePlugins(ctx) returns an array',
    run: (a, ctx) => {
      const plugins = a.vitePlugins(ctx);
      if (!Array.isArray(plugins)) fail('vitePlugins must return an array');
      for (const p of plugins) {
        if (!p || typeof p !== 'object' || typeof (p as { name?: unknown }).name !== 'string') {
          fail(`vitePlugins returned an element without a name: ${JSON.stringify(p)}`);
        }
      }
    },
  },
  {
    name: 'contentSources(ctx) returns an array of strings',
    run: (a, ctx) => {
      const sources = a.contentSources(ctx);
      if (!Array.isArray(sources)) fail('contentSources must return an array');
      for (const s of sources) {
        if (typeof s !== 'string') fail(`contentSources includes non-string: ${typeof s}`);
      }
    },
  },
  {
    name: 'emitTokens(settings) returns a string',
    run: (a) => {
      const out = a.emitTokens({});
      if (typeof out !== 'string') fail(`emitTokens must return a string, got ${typeof out}`);
    },
  },
  {
    name: 'emitTokens is deterministic for identical input',
    run: (a) => {
      const settings = { colors: { primary: '#000' } };
      const a1 = a.emitTokens(settings);
      const a2 = a.emitTokens(settings);
      if (a1 !== a2) {
        fail(`emitTokens returned non-deterministic output:\n  first: ${a1}\n  second: ${a2}`);
      }
    },
  },
  {
    name: 'extractCritical(html, css) returns a string',
    run: (a) => {
      const out = a.extractCritical('<html></html>', '* { box-sizing: border-box; }');
      if (typeof out !== 'string') fail(`extractCritical must return a string, got ${typeof out}`);
    },
  },
];

export const jsAdapterCases: ReadonlyArray<ConformanceCase<JsAdapter>> = [
  {
    name: 'exposes a non-empty `name`',
    run: (a) => {
      if (typeof a.name !== 'string' || a.name.length === 0) {
        fail('JsAdapter.name must be a non-empty string');
      }
    },
  },
  {
    name: 'vitePlugins(ctx) returns an array',
    run: (a, ctx) => {
      const plugins = a.vitePlugins(ctx);
      if (!Array.isArray(plugins)) fail('vitePlugins must return an array');
      for (const p of plugins) {
        if (!p || typeof p !== 'object' || typeof (p as { name?: unknown }).name !== 'string') {
          fail(`vitePlugins returned an element without a name: ${JSON.stringify(p)}`);
        }
      }
    },
  },
  {
    name: 'discoverEntries(ctx) returns an EntryPoint array',
    run: (a, ctx) => {
      const entries = a.discoverEntries(ctx);
      if (!Array.isArray(entries)) fail('discoverEntries must return an array');
      for (const e of entries) {
        if (!e || typeof e !== 'object') {
          fail(`discoverEntries returned non-object: ${JSON.stringify(e)}`);
        }
        if (typeof e.id !== 'string' || typeof e.file !== 'string') {
          fail(`EntryPoint must have string id + file: ${JSON.stringify(e)}`);
        }
      }
    },
  },
  {
    name: '`hydrationRuntime` is a non-empty string',
    run: (a) => {
      if (typeof a.hydrationRuntime !== 'string' || a.hydrationRuntime.length === 0) {
        fail('hydrationRuntime must be a non-empty string');
      }
    },
  },
  {
    name: 'generateComponentBindings(section) returns a string',
    run: (a) => {
      const out = a.generateComponentBindings({
        handle: 'noop',
        sourcePath: '/tmp/noop.liquid',
      });
      if (typeof out !== 'string') {
        fail(`generateComponentBindings must return a string, got ${typeof out}`);
      }
    },
  },
];

/**
 * A do-nothing CssAdapter implementation. Used as a self-test: the
 * conformance suite must pass against this stub. Third-party adapters
 * can also start from it.
 */
export const noopCssAdapter: CssAdapter = {
  name: 'noop',
  vitePlugins: () => [],
  contentSources: () => [],
  emitTokens: () => '',
  extractCritical: () => '',
};

export const noopJsAdapter: JsAdapter = {
  name: 'noop',
  vitePlugins: () => [],
  discoverEntries: () => [],
  hydrationRuntime: '/dev/null',
  generateComponentBindings: () => '',
};
