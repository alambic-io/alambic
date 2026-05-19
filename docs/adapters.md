# Adapter Contract

Adapters are the only seam between Alambic core and a specific runtime stack. This document is the canonical reference for what an adapter must implement, how it is consumed, and how to build one.

If you only want to use the default Tailwind v4 + Alpine stack, you don't need this document — install `@alambic/preset-tailwind-alpine` and move on.

---

## 1. The contract, in one paragraph

A preset is a pair `{ css: CssAdapter, js: JsAdapter }`. Each adapter is an object implementing a small, stable interface defined in `@alambic/adapters`. Alambic core calls the adapter's methods at well-defined points in the dev/build lifecycle. An adapter is valid if and only if it passes the adapter conformance test suite shipped from `@alambic/adapters/conformance`.

## 2. Interfaces

Imported from `@alambic/adapters`.

### 2.1 `CssAdapter`

```ts
export interface CssAdapter {
  readonly name: string;

  /** Vite plugins to inject for CSS handling. Run in `apply: 'serve'` and `apply: 'build'`. */
  vitePlugins(ctx: AdapterContext): Plugin[];

  /** File globs to scan for class names / utility usage. */
  contentSources(ctx: AdapterContext): string[];

  /** Emit a CSS string of `--var-name: value;` from theme settings. */
  emitTokens(settings: ThemeSettings): string;

  /** Critical CSS extraction. Pure function. */
  extractCritical(html: string, fullCss: string): string;
}
```

### 2.2 `JsAdapter`

```ts
export interface JsAdapter {
  readonly name: string;

  vitePlugins(ctx: AdapterContext): Plugin[];

  /** Find client entry points. Default: `sections/<name>/client.{ts,js}`. */
  discoverEntries(ctx: AdapterContext): EntryPoint[];

  /** Absolute path to the built hydration runtime JS. */
  hydrationRuntime: string;

  /** Per-section bindings (typed-store boilerplate, component registration, etc.). */
  generateComponentBindings(section: CompiledSection): string;
}
```

### 2.3 Supporting types

```ts
export interface AdapterContext {
  readonly mode: 'dev' | 'build';
  readonly themeRoot: string;        // absolute path to source theme
  readonly outputRoot: string;       // absolute path to .alambic/theme
  readonly sections: ReadonlyArray<CompiledSection>;
  readonly settings: ThemeSettings;
  readonly logger: Logger;
}

export interface EntryPoint {
  /** Identifier used by the manifest. Convention: `sections/<name>`. */
  readonly id: string;
  /** Absolute path to source. */
  readonly source: string;
  /** Section handle this entry hydrates, if any. */
  readonly section?: string;
}

export interface CompiledSection {
  readonly handle: string;
  readonly schema: SectionSchema;       // from @alambic/schema
  readonly liquidPath: string;
  readonly clientPath?: string;
  readonly stylesPath?: string;
}
```

## 3. Lifecycle

```
dev start                build start
  │                        │
  ▼                        ▼
adapter.vitePlugins(ctx)   adapter.vitePlugins(ctx)
adapter.contentSources()   adapter.contentSources()
adapter.discoverEntries()  adapter.discoverEntries()
  │                        │
  ▼                        ▼
Vite dev server runs       Vite builds
  │                        │
  │                        adapter.emitTokens(settings) ──► tokens.css
  │                        adapter.extractCritical(html, css) ──► template-critical.css
  │                        adapter.generateComponentBindings(s) ──► section bindings
  ▼                        ▼
File change                Manifest emit
  │                        │
adapter.emitTokens() if    Theme emit
config/settings_data
changed
```

Adapters must be **pure** with respect to filesystem side effects outside their declared outputs. Alambic core owns the filesystem; adapters return data.

## 4. Conformance test suite

Every adapter must pass the suite shipped from `@alambic/adapters/conformance`. The current suite is structural — it asserts each adapter method exists, returns the right shape, and behaves deterministically:

- `vitePlugins(ctx)` returns an array of named Vite plugins.
- `contentSources(ctx)` returns an array of strings (no non-string elements).
- `emitTokens(settings)` returns a string and is deterministic for identical input.
- `extractCritical(html, css)` returns a string.
- `discoverEntries(ctx)` returns `EntryPoint[]` (each with string `id` + `file`).
- `hydrationRuntime` is a non-empty string.
- `generateComponentBindings(section)` returns a string.

Deeper checks (full builds against a fixture theme, type-checking the generated bindings, etc.) live in `packages/preset-tailwind-alpine/src/preset.test.ts` rather than the conformance suite itself — the suite stays cheap so third-party adapters can run it without bringing up a real Vite build.

To run the suite against your adapter:

```ts
// my-adapter/test/conformance.test.ts
import { describe, test } from 'vitest';
import {
  cssAdapterCases,
  jsAdapterCases,
  makeStubContext,
} from '@alambic/adapters/conformance';
import { myPreset } from '../src';

describe('my-preset conformance', () => {
  const preset = myPreset();
  const ctx = makeStubContext({ themeRoot: '/tmp/conformance-theme' });
  for (const c of cssAdapterCases) {
    test(`css / ${c.name}`, () => c.run(preset.css, ctx));
  }
  for (const c of jsAdapterCases) {
    test(`js / ${c.name}`, () => c.run(preset.js, ctx));
  }
});
```

## 5. Reference: `preset-tailwind-alpine`

Looking at `packages/preset-tailwind-alpine/src/` is the fastest way to understand adapter implementation in practice.

- `css/tailwind-adapter.ts` — wires Tailwind v4's Vite plugin, scans `.liquid` for utilities, emits theme tokens as `@theme` CSS variables, uses `@critters` for critical CSS.
- `js/alpine-adapter.ts` — discovers `client.ts` files, generates Alpine `data()` / `store()` bindings typed from the section schema, ships a 2 KB hydration runtime.
- `runtime/hydrate.ts` — the browser-side runtime that reads the islands manifest and registers Alpine components per hydration strategy.

## 6. Versioning

Adapter contracts follow the package's major version. A breaking change to the interfaces is a major version bump of `@alambic/adapters` and triggers a coordinated release of every preset.

Between major versions:
- Adding a new method is a minor bump. Old adapters keep working; they don't get the new capability.
- Adding a new field to an existing method's input is a minor bump if it has a default.
- Removing or renaming anything is a major bump.

Adapters declare the contract version they target via `peerDependencies`:

```json
{
  "peerDependencies": {
    "@alambic/adapters": "^1.0.0"
  }
}
```

## 7. Distribution

Adapters are normal npm packages. We recommend the naming convention `alambic-preset-<name>` (unscoped) for community presets, leaving `@alambic/preset-*` for first-party.

A preset is registered in the consumer's `alambic.config.ts`:

```ts
import { defineConfig } from '@alambic/core';
import { tailwindAlpine } from '@alambic/preset-tailwind-alpine';

export default defineConfig({
  preset: tailwindAlpine(),
});
```

Or in pieces if you want to mix:

```ts
import { defineConfig } from '@alambic/core';
import { tailwindCss } from '@alambic/preset-tailwind-alpine/css';
import { stimulus } from 'alambic-preset-stimulus';

export default defineConfig({
  css: tailwindCss(),
  js: stimulus(),
});
```

The `preset` shorthand and the per-adapter form are interchangeable.
