# @alambic/core

> Orchestrator. The Vite plugin entry point, the dev server, the build pipeline. Everything else plugs into core.

This is the only package that talks directly to Vite and the Shopify CLI. Other packages contribute capabilities via well-defined extension points.

---

## Purpose

`@alambic/core` does five things and only these five:

1. Reads `alambic.config.ts` and constructs an `AdapterContext`.
2. Exposes a Vite plugin factory: `alambic({ preset })`.
3. Runs the dev server: starts Vite, spawns `shopify theme dev`, proxies HTTP, wires HMR.
4. Runs the build: invokes Vite build, emits the theme directory.
5. Provides cross-cutting utilities used by every other package: the logger, the error type, the event bus.

It does **not** know what Tailwind, Alpine, schemas, or types are. Those live in feature packages and are consumed via well-defined APIs.

## Public API

Exports from `src/index.ts`:

```ts
// Config
export { defineConfig, resolveConfig } from './config';
export type { AlambicConfig, AlambicPluginOptions, ResolvedAlambicConfig } from './types';

// Vite plugin
export { alambic } from './plugin';

// Environment
export {
  env,
  environmentToCliFlags,
  isEnvRef,
  resolveEnvironment,
  type Environment,
  type EnvRef,
  type EnvValue,
  type ResolvedEnvironment,
} from './env';
export { applyEnvFiles } from './env/load-env';

// Staging (src → .alambic/theme transformation)
export { buildStaging, type BuildStagingOptions } from './staging/build';
export { watchStaging, type StagingWatcher, type WatchStagingOptions } from './staging/watch';
export { mapFile, type MapResult } from './staging/map';

// Infrastructure
export { AlambicError, isAlambicError, type AlambicErrorOptions } from './errors';
export { createLogger, type Logger, type LogLevel } from './logger';
export { createEventBus, type EventBus, type EventName, type EventHandler, type AlambicEvents, type FileChangedKind } from './events';
```

Anything else is internal.

### `defineConfig`

Identity-with-types helper for `alambic.config.ts`. `themeRoot` defaults to `'./src'`; `output` defaults to `'./.alambic/theme'` (a hidden staging directory used by both `alambic dev` and `alambic build`):

```ts
import { defineConfig, env } from '@alambic/core';
import { tailwindAlpine } from '@alambic/preset-tailwind-alpine';

export default defineConfig({
  preset: tailwindAlpine(),
  environments: {
    dev:  { store: env('SHOPIFY_DEV_STORE'),  themeId: env('SHOPIFY_DEV_THEME_ID') },
    prod: { store: env('SHOPIFY_PROD_STORE'), themeId: env('SHOPIFY_PROD_THEME_ID') },
  },
  defaultEnvironment: 'dev',
});
```

### `alambic`

Vite plugin factory. Returns a `Plugin[]` (multiple plugins because we orchestrate sub-plugins).

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { alambic } from '@alambic/core';
import config from './alambic.config';

export default defineConfig({
  plugins: [alambic(config)],
});
```

## Internal modules

```
src/
├── index.ts                # Public exports
├── types.ts                # AlambicConfig, ResolvedAlambicConfig, plugin options
├── config/
│   └── index.ts            # defineConfig, resolveConfig (env-aware)
├── env/
│   ├── index.ts            # env(), Environment, resolveEnvironment, environmentToCliFlags
│   └── load-env.ts         # applyEnvFiles (delegates to Vite's loadEnv)
├── plugin/
│   ├── index.ts            # `alambic()` factory + orchestrator plugin
│   ├── asset-snippet.ts    # alambic-asset.liquid rendering (dev + build modes)
│   ├── entries.ts          # Default convention-based entry discovery
│   └── shopify-cli.ts      # Spawn `shopify theme dev` (stdio: inherit)
├── staging/
│   ├── map.ts              # mapFile() — src/ → .alambic/theme/ path rules
│   ├── build.ts            # buildStaging() — one-shot transform
│   └── watch.ts            # watchStaging() — chokidar-backed live sync
├── events/
│   └── index.ts            # Typed event bus
├── errors/
│   └── index.ts            # AlambicError
├── logger/
│   └── index.ts            # consola wrapper, scoped loggers
└── internal/
    └── theme-paths.ts      # entryIdFor() helper
```

## Dependencies on other Alambic packages

- `@alambic/adapters` — consumes `CssAdapter` and `JsAdapter` to invoke their hooks at the right lifecycle points.
- `@alambic/manifest` — calls into manifest emission during build.

That's it. `core` does not depend on `schema`, `types`, `hmr`, `islands` directly. Those packages depend on `core` (for the logger and event bus) and register via the event bus or expose their own Vite plugins that `core` includes.

## Lifecycle events on the bus

Emitted by `core`:

- `dev:start` — dev server starting.
- `dev:ready` — both Vite and Shopify CLI are accepting connections.
- `dev:shutdown` — graceful shutdown begun.
- `file:changed` — `{ path, kind: 'liquid' | 'ts' | 'css' | 'config' | 'locale' | 'template' }`.
- `theme:pushed` — the dev theme push to Shopify completed for a given file.
- `build:start`, `build:emit`, `build:done`.

Subscribers (other packages):
- `@alambic/hmr` listens to `theme:pushed` to trigger section-update HMR events.
- `@alambic/types` listens to `file:changed` to debounce type-gen.
- `@alambic/schema` listens to `file:changed` for `.ts` files under `sections/` to recompile schemas.

## Testing

- Unit tests for config loading, error formatting, the logger.
- Integration tests in `test/integration/` boot a dev server against a fixture theme and assert lifecycle events.
- Use `@alambic/test-utils` `createDevServer()` to spin up a sandboxed instance.

## Claude Code notes

- This package is the most sensitive to changes. Touch with care.
- The Shopify CLI subprocess management is the trickiest part. Read `src/plugin/shopify-cli.ts` thoroughly before touching it; there are subtle race conditions in startup and shutdown that the existing tests exercise.
- If you're tempted to add a feature here, ask: can it live in a downstream package that subscribes to the event bus? Usually the answer is yes.
- The `alambic()` plugin factory must always return an idempotent plugin array — running Vite twice in the same process must work.
