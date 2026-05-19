# Architecture

This document is the source of truth for how Alambic's pieces fit together. Read root `CLAUDE.md` first for project mission and the package list at a glance; this doc goes one level deeper into contracts and data flow.

---

## 1. Layering

Alambic is a stack of layers. Each layer depends only on layers below it.

```
┌─────────────────────────────────────────────────────────┐
│  Consumer theme (Liquid + TS authored sections)         │
├─────────────────────────────────────────────────────────┤
│  Preset                @alambic/preset-tailwind-alpine  │
├─────────────────────────────────────────────────────────┤
│  Adapters              @alambic/adapters                │
│  ├ CssAdapter contract                                  │
│  └ JsAdapter contract                                   │
├─────────────────────────────────────────────────────────┤
│  Feature packages                                       │
│  ├ @alambic/schema     (TS → JSON schema + types)       │
│  ├ @alambic/types      (theme-wide type gen)            │
│  ├ @alambic/islands    (per-section JS chunks)          │
│  ├ @alambic/manifest   (per-template manifest + budgets)│
│  └ @alambic/lsp        (Liquid LSP server)              │
├─────────────────────────────────────────────────────────┤
│  Orchestrator          @alambic/core                    │
├─────────────────────────────────────────────────────────┤
│  Runtime               Shopify CLI + Vite 8             │
└─────────────────────────────────────────────────────────┘
```

The CLI (`@alambic/cli`) and scaffolder (`create-alambic`) live alongside this stack but don't sit in it — they invoke `@alambic/core` and the feature packages directly.

## 2. Runtime topology in `dev` mode

```
            User browser
                │
       ┌────────┴─────────┐
       │                  │
       ▼                  ▼
 http://localhost   http://127.0.0.1
       :5173             :9292
       │                  │
 ┌─────┴──────┐    ┌──────┴────────────────────┐
 │ Vite 8 dev │    │ shopify theme dev          │
 │ server     │    │ (spawned by core, reads   │
 │ — JS/CSS   │    │   .alambic/theme/ via      │
 │   HMR      │    │   `--path`)                │
 └─────┬──────┘    └──────┬────────────────────┘
       │                  │
       │                  ▼
       │            Shopify preview shop
       │                  │
       └── staging dir ◄──┘
           .alambic/theme/
                ▲
                │ chokidar watcher
                │
              src/      (author's nested layout)
```

Phase 1 model: Vite and the Shopify CLI run side-by-side on different ports. The Shopify CLI reads from `.alambic/theme/`, a staging directory kept in sync with `src/` by `@alambic/core/staging` (`buildStaging` + `watchStaging`). The Liquid layout uses `{% render 'alambic-asset', entry: '<id>' %}`; the generated snippet emits Vite-dev-server URLs in dev mode and hashed `assets/` URLs in build mode.

**Future (Phase 3+):** introduce HTTP proxying so the browser hits a single Alambic-served URL that fans out to Vite (assets) and the Shopify CLI (everything else). That lets us inject HMR/event-bus traffic alongside Shopify's own preview reload.

What this lets us do:
- Inject the HMR WebSocket alongside Shopify's own preview hot-reload (Phase 3+).
- Resolve asset URLs to Vite-served files in dev and hashed `assets/` files in production via the same `alambic-asset` snippet.
- Run middleware before responses reach the browser (for the islands hydration manifest, etc. — Phase 4+).

## 3. Build pipeline

```
src/
  sections/<name>/
    index.liquid
    schema.ts          (Phase 2)
    index.css          (Vite)
    client.ts          (Vite)
  snippets/...
  templates/...
  config/...
  locales/...
  layout/...

         │
         ▼  alambic build
         │
┌────────────────────────────────────────────────────────┐
│  1. Staging copy      @alambic/core/staging            │
│     src/ → .alambic/theme/ via mapFile rules:          │
│       sections/<name>/index.liquid →                   │
│         sections/<name>.liquid     (flatten)           │
│       snippets/, templates/, config/, locales/,        │
│         layout/, blocks/, assets/  (passthrough)       │
│       *.ts/*.css/*.scss/*.less     (skip — Vite owns)  │
│                                                        │
│  2. Schema compile    @alambic/schema       (Phase 2)  │
│     sections/<name>/schema.ts → inlined as `{% schema  │
│     %}` block inside `.alambic/theme/sections/         │
│     <name>.liquid`                                     │
│                                                        │
│  3. Type gen          @alambic/types        (Phase 2)  │
│     → .alambic/types/index.d.ts                        │
│                                                        │
│  4. Adapter scan      @alambic/adapters                │
│     Tailwind: scan .liquid + schemas → content list    │
│     Alpine: discover client.ts entries                 │
│                                                        │
│  5. Vite build        Vite 8 + plugins                 │
│     - Convention or adapter-driven entry points        │
│     - Per-island chunks                  (Phase 4)     │
│     - CSS extraction                                   │
│     → .alambic/theme/assets/<entry>-<hash>.{js,css}    │
│                                                        │
│  6. Manifest build    @alambic/core (Phase 1)          │
│                       @alambic/manifest (Phase 5)      │
│     - Inlined per-entry mapping in                     │
│       .alambic/theme/snippets/alambic-asset.liquid     │
│     - Per-template manifest             (Phase 5)      │
│     - Critical CSS per template         (Phase 5)      │
│     - Performance budget check          (Phase 5)      │
│                                                        │
│  7. Push (optional)   `shopify theme push --path       │
│                       .alambic/theme` (Phase 3 wires   │
│                       this via `alambic push --env`)   │
└────────────────────────────────────────────────────────┘
```

`.alambic/theme/` is what Shopify expects — a flat theme directory. The same path also serves as the live-synced staging dir during `alambic dev`, so the Shopify CLI reads from a single location in both modes. A theme produced by Alambic can be opened in any other Shopify tool.

## 4. Data flow during `dev`

```
File change                 What Alambic does
──────────────              ──────────────────────────────────────────
sections/x/styles.css   →   Vite CSS HMR. No DOM swap.
sections/x/client.ts    →   Vite JS HMR. Alpine module reloaded in
                            place; component reinitialized.
sections/x/index.liquid →   1. Recompile section.
                            2. Push file to Shopify dev theme via CLI.
                            3. Wait for Shopify to acknowledge.
                            4. Send HMR event {kind: 'section-update',
                               handle: 'x'}.
                            5. Browser client fetches via Section
                               Rendering API: /?sections=x
                            6. Replace DOM node, re-run hydration for
                               just this section.
sections/x/schema.ts    →   Recompile schema → write sections/x.json
                            → regenerate .alambic/types → trigger
                            section-update as above.
config/settings_data.   →   Regenerate token CSS variables, push CSS
.json                       HMR, regenerate Theme.Settings types.
locales/*.json          →   Regenerate locale types, full reload (no
                            way to hot-swap server-rendered text).
templates/*.json        →   Regenerate per-template manifest, full
                            reload.
```

The HMR protocol is documented in `packages/hmr/src/protocol.ts` and stable across minor versions.

## 5. Adapter contract

The adapter contract is the only thing standing between Alambic core and the actual stack. It lives in `@alambic/adapters` and is intentionally small.

### 5.1 CssAdapter

```ts
export interface CssAdapter {
  readonly name: string;

  /**
   * Called once during Vite config setup. Return Vite plugins
   * to inject for CSS processing.
   */
  vitePlugins(ctx: AdapterContext): Plugin[];

  /**
   * Return the list of file globs to scan for class names /
   * utility usage. Includes .liquid, .ts, schema fixtures.
   */
  contentSources(ctx: AdapterContext): string[];

  /**
   * Convert theme settings (settings_data.json) into a CSS
   * variable block. Called at build and on settings change in dev.
   */
  emitTokens(settings: ThemeSettings): string;

  /**
   * Critical CSS extraction strategy. Receives the template HTML
   * and returns the critical subset.
   */
  extractCritical(html: string, fullCss: string): string;
}
```

### 5.2 JsAdapter

```ts
export interface JsAdapter {
  readonly name: string;

  vitePlugins(ctx: AdapterContext): Plugin[];

  /**
   * Discover client entry points. Default convention is
   * `sections/<name>/client.ts` but adapters can override.
   */
  discoverEntries(ctx: AdapterContext): EntryPoint[];

  /**
   * Hydration runtime — the JS that runs in the browser to
   * mount components for islands matching this adapter's
   * convention.
   */
  hydrationRuntime: string;  // absolute path to a built JS file

  /**
   * Bridge between Alambic's typed schemas and the adapter's
   * component model. For Alpine, this generates the magic
   * properties / data() boilerplate.
   */
  generateComponentBindings(section: CompiledSection): string;
}
```

### 5.3 AdapterContext

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

Any adapter implementing these three interfaces is a valid Alambic preset. The reference implementation is `@alambic/preset-tailwind-alpine`. The conformance test suite is exported from `@alambic/adapters/conformance` — passing it is the definition of "valid adapter."

## 6. Schema DSL (overview)

```ts
import { section, text, image, range, blocks } from '@alambic/schema';

export default section({
  name: 'product-card',
  preset: { name: 'Product card', category: 'Product' },
  settings: {
    heading: text({ label: 'Heading', default: 'New arrival' }),
    image: image({ label: 'Image', aspect: '1/1' }),
    rounding: range({ min: 0, max: 32, step: 2, unit: 'px', default: 8 }),
  },
  blocks: blocks({
    badge: { settings: { text: text({ label: 'Badge text' }) } },
    cta:   { settings: { label: text(), url: link() } },
  }),
});
```

This compiles to:

1. An inlined `{% schema %}` block inside `.alambic/theme/sections/product-card.liquid` — Shopify's expected format.
2. A TypeScript declaration registered in `Theme.Section<'product-card'>`.
3. A Liquid type-hint sidecar consumed by the LSP for autocomplete inside `index.liquid`.

Full reference: `packages/schema/CLAUDE.md`.

## 7. Type generation pipeline

`@alambic/types` produces a single ambient declaration file at `.alambic/types/index.d.ts` from these inputs:

| Input | Generator | Output type |
|---|---|---|
| `config/settings_schema.json` | `settings-schema` | `Theme.Settings` |
| `config/settings_data.json` | `settings-data` | `Theme.Settings.Current` |
| `sections/*/schema.ts` | `sections` | `Theme.Section<H>` |
| Metaobject defs (Admin GraphQL introspection) | `metaobjects` | `Theme.Metaobject<H>` |
| Metafield defs (Admin GraphQL) | `metafields` | `Theme.Metafield<N, K>` |
| `locales/*.json` | `locales` | `Theme.LocaleKey`, `t()` helper |
| Storefront API (codegen) | `storefront` | `Storefront.*` |

Each generator is a pure function `(input) => GeneratedFile[]`. Determinism is required (snapshot-tested).

Generated files have a stable header:

```ts
// alambic:generated @alambic/types@<version> — do not edit
// source: <input file>
// hash: <sha256 of input>
```

The consumer's `tsconfig.json` adds `.alambic/types` to `include`.

## 8. Section-aware HMR

Provided by Shopify CLI's built-in `theme-hot-reload.js` (default `--live-reload hot-reload` mode). When the dev server (via `--path .alambic/theme`) detects a change and syncs it, the injected script does a section-aware DOM swap on the preview without a full page reload.

This requires the browser to access the preview via the local proxy URL (`http://127.0.0.1:9292`). The `myshopify.com` share URL does **not** inject the hot-reload script — that's by design on Shopify's side.

An earlier `@alambic/hmr` package implemented this manually via Vite's WS + the Section Rendering API. It was racing the CLI's own better implementation and got deleted in Phase 3. If a future need arises (e.g. once we proxy `:9292` through Vite), the ~300 LOC of that approach can be rebuilt cleanly.

## 9. Islands

### Phase 4-lite (shipped)

Sections opt into hydration by wrapping their root markup inline:

```liquid
<alambic-island data-section="product-gallery" data-load="visible">
  <section>...</section>
</alambic-island>
```

Strategies in the shipped runtime:

- `eager` (default) — hydrate on `connectedCallback`.
- `visible` — hydrate on first IntersectionObserver hit (rootMargin 200px).

A section's `client.ts` exports `setup(ctx)` as its default. The orchestrator emits one chunk per `client.ts` plus a separately-hashed `alambic-runtime` chunk. The runtime reads `window.__alambic.manifest.entries[section]`, dynamic-imports the chunk, and calls `setup({root, section, strategy})`. Framework-neutral — sections decide what `setup` does.

The orchestrator emits one snippet, `alambic-islands.liquid`, rendered once in `layout/theme.liquid`. In dev it inlines the runtime + a JSON manifest pointed at Vite URLs. In build it inlines a Liquid-interpolated manifest (`{{ '…' | asset_url }}`) plus a `<script type="module">` pointing at the bundled `alambic-runtime` asset.

### Phase 4-full (deferred — vision below)

The shipped strategies are intentionally minimal. The strategies below are *not* implemented today; they're the long-form vision should they become necessary:

- `load` / `idle` / `hover` / `media:(query)` / `none` strategies via a richer directive set.
- A per-template manifest that lists only the islands actually rendered in each template's sections.
- A `{% render 'island', ... %}` snippet (deferred because Liquid snippets don't transparently pass content blocks).

The shipped runtime is the smallest viable thing; promote sections to the full system only if a real use case appears.

## 10. Per-template manifest

### Phase 5-lite (shipped)

Built by `@alambic/manifest` at the end of every build:

1. Walk `templates/*.json` and `templates/*.liquid` in the staging dir.
2. For each, collect section types — JSON `sections.<id>.type` + Liquid `{% section 'x' %}` + section-group expansion via `{% sections '<group>' %}`.
3. Cross-reference with the bundle to find each section's `client.ts` chunk and its byte size.
4. Emit `snippets/alambic-head.liquid` — a `case/when` dispatching on `template.name`, emitting `<link rel="modulepreload" href="{{ '<chunk>' | asset_url }}">` for the section chunks the template will use.
5. Check budgets (`alambic.config.ts → budgets`). `onBreach: 'fail'` aborts the build.
6. Log a table; `alambic build --report` also writes `.alambic/alambic-report.json`.

The snippet is included once in `layout/theme.liquid`:

```liquid
{% render 'alambic-head', template: template %}
```

### Phase 5-full (deferred — only build if needed)

- Critical CSS extraction per template (needs HTML produced by an embeddable server-side Liquid renderer — none of the off-the-shelf options match Shopify's runtime cheaply enough today).
- Per-template CSS chunking (today every page loads one shared CSS sheet).
- Walking Rollup's import graph for shared split chunks beyond entry granularity.
- Template suffix variants (`templates/<name>.<suffix>.json`).
- Font subsetting, image preload hints.

## 11. LSP

`@alambic/lsp` implements the Language Server Protocol over stdio. It is loaded by VS Code (and any other LSP-aware editor) via a thin extension.

Capabilities:

- Hover info on Liquid objects, resolved against generated types.
- Completion inside `{{ section.settings. }}`, `{{ block.settings. }}`, `{{ metaobject.* }}`, `{{ 'key' | t }}`.
- Diagnostics for unknown settings keys, unknown locale keys, unknown metaobject handles.
- "Go to definition" from a section render in Liquid to the section's `schema.ts`.
- Code actions: "Add setting to schema," "Add locale key."

The LSP reuses Shopify's `@shopify/theme-check-node` for base Liquid analysis and layers schema-aware diagnostics on top.

## 12. CLI surface

```
# Shipped in Phase 1:
alambic dev [--env <name>]   # Vite + Shopify CLI (`--path .alambic/theme`)
alambic build [--env <name>] # One-shot build → .alambic/theme
alambic doctor               # Workspace + theme health check

# Planned (later phases):
alambic build --push         # Build then `shopify theme push`         (Phase 3)
alambic push [--env <name>]  # Push staging dir to a specific env       (Phase 3)
alambic pull [--env <name>]  # Pull merchant-owned JSON; --into syncs    (post-5)
alambic new section <name>   # Scaffold a section folder                (Phase 2)
alambic new snippet <name>   # Scaffold a snippet                       (Phase 2)
alambic new template <name>  # Scaffold a JSON template                 (Phase 2)
alambic types                # One-shot type generation                 (Phase 2)
alambic schema check         # Validate all section schemas             (Phase 2)
alambic lsp                  # Start the Liquid LSP over stdio          (Phase 6-lite)
```

CLI is built on `commander` for output. Every command will support `--json` for machine-readable output (used by CI and Claude Code) as it lands.

## 13. Environment configuration

`alambic.config.ts` declares named environments. Each environment maps to a `(store, themeId, storePassword)` triple, with values either as literal strings or `env('VAR_NAME')` references that resolve against `.env*` files at command time.

```ts
import { defineConfig, env } from '@alambic/core';

export default defineConfig({
  environments: {
    dev:     { store: env('SHOPIFY_DEV_STORE'),     themeId: env('SHOPIFY_DEV_THEME_ID') },
    preprod: { store: env('SHOPIFY_PREPROD_STORE'), themeId: env('SHOPIFY_PREPROD_THEME_ID') },
    prod:    { store: env('SHOPIFY_PROD_STORE'),    themeId: env('SHOPIFY_PROD_THEME_ID') },
  },
  defaultEnvironment: 'dev',
});
```

Env-file precedence follows Vite's `loadEnv`:
- `.env`, `.env.local`, `.env.[name]`, `.env.[name].local` (lowest → highest priority)
- `.local` variants are gitignored; non-`.local` files commit non-secret defaults
- Shell-set env vars (e.g. `SHOPIFY_DEV_STORE=… pnpm dev`) always win over files

The active environment is selected by `--env <name>` (CLI flag) or `defaultEnvironment` (config). Resolved values translate to `--store`, `--theme`, `--store-password` flags passed to `shopify theme dev`. API authentication itself uses the Shopify CLI's OAuth session (`shopify auth login`); `--password` (Theme Access tokens) is not a first-class environment field.

## 13. Performance budgets

Defined in `alambic.config.ts`:

```ts
export default defineConfig({
  budgets: {
    perTemplate: {
      jsKb: 50,
      cssKb: 30,
      fontKb: 80,
    },
    perIsland: {
      jsKb: 20,
    },
  },
});
```

At build time, `@alambic/manifest` checks each template's total against budgets and fails (or warns) accordingly. CLI output:

```
✗ templates/product.json exceeds budget
    js:  62 KB / 50 KB
    css: 28 KB / 30 KB ✓
    Largest island: product-gallery (38 KB)
```

## 14. What lives where: a quick map

If you're looking for…

| Concern | Package |
|---|---|
| Section schema authoring | `@alambic/schema` |
| Theme-wide types | `@alambic/types` |
| Per-section JS chunks + `<alambic-island>` runtime | `@alambic/islands` |
| Section-aware HMR | Shopify CLI's built-in `theme-hot-reload.js` |
| Per-template manifest, critical CSS, budgets | `@alambic/manifest` |
| Adapter contracts | `@alambic/adapters` |
| Tailwind v4 + Alpine reference impl | `@alambic/preset-tailwind-alpine` |
| Vite plugin entry, dev server, build orchestration | `@alambic/core` |
| Adapter conformance suite | `@alambic/adapters/conformance` |
| Liquid LSP | `@alambic/lsp` |
| Command-line interface | `@alambic/cli` |
| Project scaffolding | `create-alambic` |
