# Roadmap

A phased plan. Phases are sequential — finish before moving on. Each phase ends with a working, releasable artifact, even if the feature surface is small.

The order optimizes for two things:
1. Getting an end-to-end dev loop working as early as possible against a real theme.
2. Locking the adapter contract before building features on top of it, so we don't repaint that wall.

---

## Phase 0 — Monorepo bootstrap (0.0.0) ✅

**Goal:** Workspace builds, lints, tests, releases a `0.0.0-alpha.0` placeholder package to npm.

- [x] Repo init, license, README, root `CLAUDE.md`, `AGENTS.md`.
- [x] pnpm workspace, Vite+ root `vite.config.ts`, base `tsconfig.base.json`.
- [x] `packages/_template/` with package.json, vite.config.ts, CLAUDE.md template.
- [x] Changesets installed, CI workflow for PR checks and release on main.
- [x] `packages/cli/` skeleton — `alambic --version` prints something.
- [x] `alambic doctor` skeleton — exits 0 with a fake "all good" message.
- [ ] First release to npm under `next` tag.  *(deferred — requires NPM_TOKEN)*

**Definition of done:** `pnpm install && vp check && vp run -r build && vp run -r test` succeeds in a clean clone. CI is green. A version-bump PR can flow through and publish.

---

## Phase 1 — Minimum viable dev loop (0.1.0) ✅

**Goal:** A consumer can run `pnpm dev` and see Vite-served JS/CSS in a Shopify dev theme. No HMR fanciness yet, no schemas, no types. Just barrel-parity.

- [x] `@alambic/adapters` — contract types only, no implementations.
- [x] `@alambic/core` — Vite plugin that:
  - Detects entry points by convention.
  - Generates an `alambic-asset.liquid` snippet (dev + build modes).
  - Spawns `shopify theme dev` reading from `.alambic/theme/` via `--path`.
  - Owns the staging dir: `buildStaging` (one-shot) + `watchStaging` (live sync).
  - Logger, AlambicError, EventBus.
- [x] `@alambic/preset-tailwind-alpine` — Tailwind v4 + Alpine wired through the adapter contract (token gen + critical CSS + generated bindings deferred to Phase 2/5).
- [x] `@alambic/cli` — `alambic dev`, `alambic build`, `alambic doctor`.
- [x] `examples/tailwind-alpine-theme/` — a working theme to test against.
- [x] `create-alambic` — first version, copies the example theme.

**Phase 1.5 additions** (not in the original Phase 1 scope but landed alongside):
- [x] Environment management — `environments`, `defaultEnvironment`, `env('VAR')`, `--env <name>`. Vite-style `.env.[name][.local]` loading. Active env translates to `--store` / `--theme` / `--store-password` flags.
- [x] Staging architecture — nested section folders in `src/` automatically flattened to Shopify-compliant `sections/<name>.liquid` in `.alambic/theme/`. Live watcher in dev.

**Definition of done:** `pnpm create alambic test-theme && cd test-theme && pnpm dev` shows the storefront with Vite-served assets and basic CSS HMR. `pnpm build && shopify theme push --path .alambic/theme` produces a working theme.

**Still deferred to later phases:**
- HTTP proxying through Vite (Phase 3+). Today Vite (`:5173`) and `shopify theme dev` (`:9292`) run side-by-side; the `alambic-asset` snippet emits `:5173` URLs in dev.
- Section-aware HMR via Section Rendering API (Phase 3).
- Schema compile from `sections/<name>/schema.ts` → inlined `{% schema %}` block (Phase 2; today `{% schema %}` is authored inside `index.liquid`).
- Type generation (Phase 2).
- Token emission, critical CSS, generated Alpine bindings, per-island hydration (Phase 2/4/5).
- `alambic push` / `alambic build --push` (Phase 3).
- `alambic new …` scaffolding inside an existing theme (Phase 2).

---

## Phase 2 — Schemas and types (0.2.0) ✅

**Goal:** TS-authored section + theme-block schemas, end-to-end type generation, the editor lights up.

- [x] `@alambic/schema` — DSL covering **all 30+ Shopify setting types** (basic / rich text / media / resource pickers / color / typography / structural), `section()`, `themeBlock()`, `block()` builders + `block.theme()` / `block.app()` / `block.named()` references, compiler producing Shopify-format JSON, regex-safe `{% schema %}` inliner (skips `{% comment %}` / `{% raw %}` contexts), and validation rules (duplicate ids, range bounds, local-vs-theme block conflict, etc.).
- [x] `@alambic/types` — discovers `sections/*/schema.ts` and `blocks/*/schema.ts`, emits `Theme.SectionMap` / `Theme.BlockMap` / `Theme.Section<H>` / `Theme.Block<H>` plus an opaque `Shopify.*` runtime-object namespace.
- [x] Staging integration — `sections/<name>/index.liquid` + `sections/<name>/schema.ts` → flat `sections/<name>.liquid` with `{% schema %}` inlined. Same pattern for `blocks/<name>/...` (Shopify 2024 theme blocks).
- [x] Watcher reacts to `schema.ts` edits — re-runs the inline within ~80ms.
- [x] `alambic types` and `alambic schema check` CLI commands.
- [x] Example theme migrated: `src/sections/hero/schema.ts` + `src/blocks/badge/{index.liquid,schema.ts}`.
- [ ] `alambic new section <name>` scaffolder — *deferred to Phase 2.5*.

**Definition of done:** Editing `sections/x/schema.ts` regenerates `Theme.Section<'x'>` and the editor picks it up within 200ms ✅ (measured: 76ms for 1 section + 1 block). Authoring a section setting with a type mismatch fails `vp check` ✅ (via `tsconfig.include` of `.alambic/types/**`).

**Reliability notes flagged during implementation:**
- Schema compilation is byte-deterministic (snapshot-tested) but Shopify's own format can drift between versions. Track via the `__fixtures__/shopify-reference/` directory (TODO Phase 2.5).
- The `{% schema %}` inliner handles `{% comment %}` and `{% raw %}` escape contexts. Liquid extensions beyond those (custom delimiters, weird whitespace) could still produce edge cases — open a bug if you hit one.
- Theme blocks support `block.theme()` for nesting any other theme block; cyclic nesting is allowed by Shopify but we don't currently detect cycles statically.
- Runtime `Shopify.*` types (Image, Product, etc.) are intentionally opaque branded interfaces in Phase 2. Phase 7 (LSP) wires the full structural types from Shopify's `theme-liquid-docs`.

---

## Phase 3 — Hot-reload + push (0.3.0) ✅

**Goal:** Editing a `.liquid` file swaps just that section's DOM, preserving state elsewhere. Plus `alambic push` for environment-aware deploys.

**The realization mid-phase:** Shopify CLI's default `--live-reload hot-reload` mode already injects `theme-hot-reload.js` into the preview, which does section-aware DOM swaps with perfect timing (it's part of the CLI's own push loop). Our first cut (`@alambic/hmr` with its own Vite WS + Section Rendering API + DOM swap + 800ms delay) was reimplementing what Shopify already shipped — and racing it.

**What landed:**

- [x] **Use Shopify's built-in hot-reload.** Don't pass `--live-reload off` — let the CLI default to `hot-reload`. Section-aware Liquid swaps work out of the box, sub-second.
- [x] **CSS/JS HMR via Vite.** Already worked since Phase 1. Sub-100ms.
- [x] `alambic push [--env <name>] [--no-build]` — env-aware deploy. Refuses to run without resolved `store` + `themeId`. Runs `alambic build` first by default; `--no-build` for fast iteration. Shells out to `shopify theme push --path .alambic/theme --store <s> --theme <id>`.
- ~~`@alambic/hmr` package~~ — initially built, then deleted. Shopify CLI's built-in hot-reload is the right layer; reimplementing it in the framework was YAGNI. If Phase 3.5 proxying ever needs a custom HMR layer, we'll rebuild it (~300 LOC, well-scoped).

**Definition of done:** Editing a section's `.liquid` updates the DOM in under 500ms on a warm cache ✅ (handled by Shopify's `theme-hot-reload.js`; sub-second in practice). Alpine `x-data` state outside the changed section is preserved ✅. Form input outside the changed section is preserved ✅; inside the swapped section it's lost (fundamental to the swap model).

**Still deferred (true Phase 3.5+ scope):**
- HTTP proxying so Vite (`:5173`) and Shopify CLI (`:9292`) share a single origin. Once proxied we can intercept the CLI's sync events for our own bus, and the `@alambic/hmr` scaffolding becomes the active HMR layer for cases Shopify's doesn't handle (e.g., complex schema-driven invalidations, cross-section state preservation).
- True intercept of the CLI's own websocket, replacing it with our own HMR layer.

**Lesson noted:** check whether the upstream tool already does what you're about to build before building it. Shopify CLI's hot-reload feature was right there in the docs the whole time.

---

## Phase 4 — Islands (0.4.0) — *Phase 4-lite landed*

**Goal:** Per-section JS chunks loaded only when needed.

**What landed (Phase 4-lite):**

- [x] `@alambic/islands` — framework-agnostic browser runtime + Liquid snippet generators.
- [x] `<alambic-island data-section="X" data-load="eager|visible">` custom element. Authored inline by sections — no wrapping snippet (Liquid doesn't pass content blocks to snippets cleanly).
- [x] Per-section client chunks. Each `src/sections/<name>/client.ts` becomes its own Rollup entry (`sections-<name>-client-<hash>.js`). Tree-shaken to near-zero when bodies are small.
- [x] Hydration manifest emitted at build time as Liquid (`{{ '…' | asset_url }}`) and inline JSON in dev. The runtime reads `window.__alambic.manifest.entries[section]`, dynamic-imports the chunk, and calls its `default` export as `setup({root, section, strategy})`.
- [x] Single `alambic-islands.liquid` snippet rendered once in `layout/theme.liquid` (writes the manifest + loads the runtime).
- [x] Two strategies only: `eager` (hydrate on connect) and `visible` (IntersectionObserver with `rootMargin: 200px`).
- [x] Framework-neutral `setup(ctx)` contract — no Alpine/React/etc. assumption. Sections decide what to do.

**Definition of done:** The example theme's `featured` section (marked `data-load="visible"`) ships its own chunk that loads only when scrolled into view. Verified: `pnpm build` emits one chunk per `client.ts` plus a separately-hashed `alambic-runtime` chunk.

**Deferred to a future Phase 4-full (only build if real need emerges):**
- Strategies beyond eager/visible (`idle`, `hover`, `media:(query)`).
- Per-section CSS islands.
- Cross-island vendor extraction (today shared deps land in the default chunk).
- Hydration metrics / TBT measurement gate in CI.

---

## Phase 5 — Per-template manifest + budgets (0.5.0) — *Phase 5-lite landed*

**Goal:** Each template loads only the islands it needs. Build-time per-template stats + budget enforcement.

**What landed (Phase 5-lite):**

- [x] `@alambic/manifest` — template tree resolution (JSON + Liquid + section groups), per-template asset graph, budget checker, JSON + table report.
- [x] `snippets/alambic-head.liquid` — auto-emitted into the staging dir. The layout renders it once via `{% render 'alambic-head', template: template %}`. Dispatches on the template name and emits `<link rel="modulepreload">` for the section client chunks the template will actually use — saves a round-trip when an island goes interactive.
- [x] `budgets` field in `alambic.config.ts` — `perTemplate.{jsKb,cssKb}` + `perIsland.jsKb` + `onBreach: 'warn' | 'fail'`. Build aborts on breach when `onBreach: 'fail'`.
- [x] `alambic build --report` — writes `<output>/../alambic-report.json` with per-template stats + budget breaches. Always logs a console table regardless of `--report`.

**Definition of done:** `pnpm build` in `examples/tailwind-alpine-theme/` logs a table with one row per template (`index`, `404`, `gift_card`), `--report` writes the JSON, and `budgets.onBreach: 'fail'` halts the build on a synthetic breach ✅.

**Still deferred to a richer Phase 5-full (build when needed):**
- Critical CSS extraction per template (needs HTML produced by a server-side render — out of scope without an embeddable Liquid engine; we treat the build's static analysis as enough today).
- Per-template CSS chunking (today every template loads the shared CSS bundle).
- Walking Rollup's import graph to account for shared split chunks beyond entry-level granularity.
- Template suffix variants (`product.alternate.json`, `.liquid` suffixes).
- Image preload hints / font subsetting.

---

## Phase 6 — LSP (0.6.0) — *Phase 6-lite landed*

**Goal:** Editor-agnostic completion + diagnostics for Alambic-flavored Liquid.

**What landed (Phase 6-lite):**

- [x] `@alambic/lsp` — LSP over stdio. Ships as the `alambic-lsp` binary plus an `alambic lsp` subcommand.
- [x] Theme index built on `initialize` and refreshed on `workspace/didChangeWatchedFiles`: schemas (via `@alambic/schema/discover`), locale keys (via `@alambic/schema/locales`), snippet names.
- [x] Completion providers (5):
  - `section.settings.<X>` in a section's `.liquid` → that section's settings.
  - `block.settings.<X>` in a theme block's `.liquid` → that block's settings.
  - `'<X>' | t` → all locale keys (default-locale value shown as documentation).
  - `{% render '<X>' %}` → snippet names.
  - `{% section '<X>' %}` → section handles.
- [x] Diagnostics:
  - Unknown locale key — warning, with source `alambic` and code `alambic/unknown-locale-key`.
  - Unknown setting id (section or block scope, only when file's schema is known) — warning, code `alambic/unknown-setting`.
- [x] Per-editor setup docs (`docs/lsp-setup.md`): VS Code, Zed, JetBrains via LSP4IJ, Neovim, Helix, Sublime Text.

**Definition of done:** Typing `section.settings.` in `examples/tailwind-alpine-theme/src/sections/hero/index.liquid` shows the hero section's settings (e.g. `heading`, `subheading`). Typing `'unknown.key' | t` shows a warning diagnostic. ✅

**Deferred (build when a real user asks):**
- Hover info (setting type + label/info).
- Go-to-definition (`{% render 'x' %}` → snippet file; `section.settings.foo` → `schema.ts` setting).
- Code actions ("Add setting to schema", "Add locale key").
- Rename refactoring.
- Metaobject / Admin API completion (blocks on Admin API integration).
- Real Liquid parsing (`@shopify/liquid-html-parser`) — today we use regex, which slips on multi-line Liquid expressions.

The Phase 6-lite implementation is intentionally complementary to `@shopify/theme-check-language-server`. Run both side-by-side; theme-check covers Liquid syntax + Shopify lints, Alambic adds schema/locale/snippet awareness.

---

## Phase 7 — Hardening and 1.0

**Goal:** Lock the public APIs. Pin documentation. Real users.

- [ ] All public APIs reviewed and frozen.
- [ ] Migration guide from `barrel/shopify-vite`.
- [ ] Two external adapters built and documented (UnoCSS + Stimulus, vanilla CSS + HTMX) to prove the adapter contract.
- [ ] At least two real-world themes shipped with Alambic.
- [ ] Performance benchmarks vs. Dawn published.
- [ ] 1.0.0 release.

---

## Cross-cutting tracks (run in parallel from Phase 2 onward)

- **Docs site** — VitePress, deployed on every release.
- **Telemetry** — anonymous opt-in usage stats so we know what to prioritize.
- **Community** — Discord or similar, RFC process, issue triage cadence.
