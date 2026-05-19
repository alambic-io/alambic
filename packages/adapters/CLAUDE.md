# @alambic/adapters

> The contract between Alambic core and a specific runtime stack. Defines `CssAdapter` and `JsAdapter` interfaces, the conformance test entry point, and the shared `AdapterContext` type.

This package contains **interfaces and types only**. No implementations. The reference implementation lives in `@alambic/preset-tailwind-alpine`. Third-party adapters import from this package and live in their own repos.

---

## Purpose

Alambic is opinionated about *what* a Shopify theme devkit should do, not *how* the CSS or JS gets processed. This package is the wall between those two concerns. It is intentionally small.

If `@alambic/adapters` is doing work, the design has drifted. It should be (almost) just `*.d.ts`.

## Public API

```ts
// Adapter interfaces
export type { CssAdapter, JsAdapter, Preset } from './contracts';

// Shared types
export type {
  AdapterContext,
  EntryPoint,
  CompiledSection,
  ThemeSettings,
  Logger,
} from './types';

// Helpers
export { definePreset, defineCssAdapter, defineJsAdapter } from './define';
```

The `define*` helpers are identity-with-types functions. They give adapter authors editor inference without runtime cost.

## Contracts

See `docs/adapters.md` for the canonical reference. Summary:

### `CssAdapter`

```ts
export interface CssAdapter {
  readonly name: string;
  vitePlugins(ctx: AdapterContext): Plugin[];
  contentSources(ctx: AdapterContext): string[];
  emitTokens(settings: ThemeSettings): string;
  extractCritical(html: string, fullCss: string): string;
}
```

### `JsAdapter`

```ts
export interface JsAdapter {
  readonly name: string;
  vitePlugins(ctx: AdapterContext): Plugin[];
  discoverEntries(ctx: AdapterContext): EntryPoint[];
  hydrationRuntime: string;
  generateComponentBindings(section: CompiledSection): string;
}
```

### `Preset`

```ts
export interface Preset {
  readonly name: string;
  readonly css: CssAdapter;
  readonly js: JsAdapter;
}
```

### `AdapterContext`

```ts
export interface AdapterContext {
  readonly mode: 'dev' | 'build';
  readonly themeRoot: string;
  readonly outputRoot: string;
  readonly sections: ReadonlyArray<CompiledSection>;
  readonly settings: ThemeSettings;
  readonly logger: Logger;
}
```

## Internal modules

```
src/
├── index.ts
├── contracts.ts               # CssAdapter, JsAdapter, Preset
├── types.ts                   # AdapterContext, EntryPoint, CompiledSection, ThemeSettings, Logger
└── define.ts                  # definePreset, defineCssAdapter, defineJsAdapter
```

That's the entire package. Adding files here should require a strong justification.

## Dependencies

None. This package depends on nothing.

It is consumed by:
- `@alambic/core` — invokes adapter methods at lifecycle points.
- `@alambic/preset-tailwind-alpine` — implements the contract.
- Any third-party adapter package — imports types from `@alambic/adapters` and the conformance suite from `@alambic/adapters/conformance`.

## Versioning

This package's major version is the contract version. A breaking change here triggers coordinated major bumps across every preset.

Between major versions:
- Adding a new optional method to an interface: minor bump. Existing adapters keep working without implementing it.
- Adding a new required method: not allowed without a major bump.
- Renaming or removing anything: major bump.

## Testing

- The conformance suite (`src/conformance.ts`) is the contract test. Every shipped check has a paired self-test in `src/conformance.test.ts` that exercises it against the bundled no-op adapters (`noopCssAdapter`, `noopJsAdapter`) — those are also exported so third-party adapter authors can start from a known-good baseline.
- The reference preset (`@alambic/preset-tailwind-alpine`) wires the same suite into its own tests; a regression in the contract or in the preset shows up there too.

## Claude Code notes

- Changes to this package ripple everywhere. Always coordinate with `@alambic/preset-tailwind-alpine` updates.
- When the contract grows, prefer optional methods over required ones for at least one minor cycle before promoting to required in the next major.
- The `define*` helpers must never add runtime behavior. They're identity functions with a type signature.
- The conformance suite is the test of the contract. If you change a contract, you must update the suite, and presets failing the new suite must be fixed before the contract change merges.
