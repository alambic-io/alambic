# @alambic/test-utils

> Vitest helpers, Playwright fixtures, the section preview server, and the adapter conformance test suite.

---

## Purpose

A single home for test infrastructure shared across packages and used by adapter authors. Without this, every package would reimplement test setup; adapters wouldn't have a way to prove conformance.

## Public API

```ts
// Vitest helpers
export { createDevServer, type DevServerHandle } from './dev-server';
export { createHmrTestHarness } from './hmr-harness';
export { createFixtureTheme } from './fixture-theme';
export { freezeClock, restoreClock } from './clock';

// Playwright
export { createPlaywrightFixture } from './playwright';

// Section preview server
export { startPreviewServer, type PreviewServerOptions } from './preview-server';

// Adapter conformance
export { runConformanceSuite } from './conformance';
```

The package is published with multiple entry points (`@alambic/test-utils/vitest`, `@alambic/test-utils/playwright`, `@alambic/test-utils/conformance`) to keep import surfaces narrow.

## Vitest helpers

### `createDevServer`

Boots an Alambic dev server against a temporary fixture theme. Returns a handle for assertions.

```ts
import { createDevServer, createFixtureTheme } from '@alambic/test-utils';

const theme = await createFixtureTheme({ from: '__fixtures__/themes/basic' });
const server = await createDevServer({ themeRoot: theme.path });

server.events.on('section-update', (event) => { /* ... */ });

await server.shutdown();
await theme.cleanup();
```

### `createHmrTestHarness`

A higher-level harness for HMR-specific tests. Reuses a single dev server across all tests in a file (boots are slow).

```ts
const harness = createHmrTestHarness({ themeFixture: 'basic' });

beforeAll(() => harness.start());
afterAll(() => harness.stop());

it('emits section-update on liquid change', async () => {
  await harness.editFile('sections/x/index.liquid', '<div>new</div>');
  const event = await harness.waitForEvent('section-update');
  expect(event.handle).toBe('x');
});
```

### `createFixtureTheme`

Copies a fixture theme to a temp directory, returns a cleanup-able handle. Tests must not mutate fixtures in place.

### `freezeClock`

Replaces `Date.now`, `performance.now`, and timer functions with deterministic stubs. Required for snapshot tests that include timestamps.

## Playwright fixture

`createPlaywrightFixture` returns a Playwright `test.extend` fixture that boots an Alambic dev server and exposes a `page` already pointed at the preview URL.

```ts
import { test as base } from '@playwright/test';
import { createPlaywrightFixture } from '@alambic/test-utils/playwright';

const test = createPlaywrightFixture(base, {
  theme: '__fixtures__/themes/preview',
});

test('product card hydrates on visible', async ({ page, alambic }) => {
  await page.goto('/products/sample');
  await alambic.scrollTo('section[data-section-id=product-card]');
  await expect(page.locator('[x-data]')).toHaveCount(1);
});
```

## Section preview server

`startPreviewServer` runs a Storybook-for-Liquid: it serves a UI that lists every section with a `stories.liquid` file and renders each variant.

```bash
alambic preview --port 4444
```

Each section can define stories:

```liquid
{%- comment -%}
  @story Default
-%}
{% render 'product-card',
  section: section,
  settings: {
    heading: 'Wireless headphones',
    image: '/preview/headphones.jpg',
    rounding: 8
  }
%}

{%- comment -%}
  @story On sale
-%}
{% render 'product-card',
  section: section,
  settings: {
    heading: 'Wireless headphones',
    on_sale: true
  }
%}
```

The preview server is driven by `@alambic/schema` to provide a properties panel for live-editing settings against the schema's type definitions.

## Adapter conformance suite

The single most important export. Runs against any `Preset` and asserts it satisfies the adapter contract.

```ts
// my-preset/test/conformance.test.ts
import { runConformanceSuite } from '@alambic/test-utils/conformance';
import { myPreset } from '../src';

runConformanceSuite(myPreset());
```

The suite covers:

1. CSS adapter:
   - `vitePlugins()` returns at least one valid Vite plugin.
   - `contentSources()` includes `*.liquid` and `*.ts` globs.
   - `emitTokens()` is deterministic and produces parseable CSS.
   - `extractCritical()` output is a strict subset of input.
2. JS adapter:
   - `vitePlugins()` returns valid Vite plugins.
   - `discoverEntries()` returns stable IDs given a fixture theme.
   - `hydrationRuntime` path resolves and is loadable.
   - `generateComponentBindings()` produces type-checkable TS.
3. End-to-end:
   - A full build against the conformance fixture theme succeeds.
   - The resulting theme passes Shopify's Theme Check.
   - The resulting theme is structurally identical (file list) to a baseline.

## Internal modules

```
src/
├── index.ts                         # Re-exports
├── vitest/
│   ├── index.ts
│   ├── dev-server.ts
│   ├── hmr-harness.ts
│   ├── fixture-theme.ts
│   └── clock.ts
├── playwright/
│   ├── index.ts
│   └── fixture.ts
├── preview-server/
│   ├── index.ts
│   ├── server.ts                    # Fastify or Hono
│   ├── render.ts                    # Liquid render against fixture data
│   └── ui/                          # Built UI shell (small Vue or Preact app)
├── conformance/
│   ├── index.ts                     # runConformanceSuite
│   ├── css-adapter.test.ts          # Imported & run
│   ├── js-adapter.test.ts
│   └── end-to-end.test.ts
└── fixtures/
    ├── themes/
    │   ├── basic/                   # Minimal viable theme
    │   ├── preview/                 # Theme with stories
    │   └── conformance/             # Used by conformance suite
    └── data/
        ├── settings_data.json
        └── metaobject-defs.json
```

## Dependencies

- `@alambic/schema` — for preview server's typed properties panel.
- `vitest` (peer) — host test runner.
- `@playwright/test` (optional peer) — only needed when using the Playwright fixture.

## Testing

- Self-test: the conformance suite is run against the in-repo `preset-tailwind-alpine` in CI as a smoke test.
- Unit tests for each helper.
- The preview server has a Playwright suite of its own that boots it against the `preview` fixture.

## Claude Code notes

- This package is the slowest to test. Use focused filters: `pnpm --filter @alambic/test-utils test <pattern>`.
- The conformance suite IS the adapter contract. Changing it changes what "valid adapter" means. Treat changes with the same care as a contract version bump.
- When adding a new helper, ask: does it belong in a generic test-utils package, or in the package being tested? The bar for inclusion is "used by at least two other packages."
- The preview server's UI is a small SPA — keep it tiny. Anything heavy belongs in the docs site, not here.
