# Roadmap

A phased plan. Phases are sequential — finish before moving on. Each phase ends with a working, releasable artifact, even if the feature surface is small.

The order optimizes for two things:
1. Getting an end-to-end dev loop working as early as possible against a real theme.
2. Locking the adapter contract before building features on top of it, so we don't repaint that wall.

---

## Phase 0 — Monorepo bootstrap (0.0.0)

**Goal:** Workspace builds, lints, tests, releases a `0.0.0-alpha.0` placeholder package to npm.

- [ ] Repo init, license, README, root `CLAUDE.md`, `AGENTS.md`.
- [ ] pnpm workspace, Vite+ root `vite.config.ts`, base `tsconfig.base.json`.
- [ ] `packages/_template/` with package.json, vite.config.ts, CLAUDE.md template.
- [ ] Changesets installed, CI workflow for PR checks and release on main.
- [ ] `packages/cli/` skeleton — `alambic --version` prints something.
- [ ] `alambic doctor` skeleton — exits 0 with a fake "all good" message.
- [ ] First release to npm under `next` tag.

**Definition of done:** `pnpm install && vp check && vp run -r build && vp run -r test` succeeds in a clean clone. CI is green. A version-bump PR can flow through and publish.

---

## Phase 1 — Minimum viable dev loop (0.1.0)

**Goal:** A consumer can run `pnpm dev` and see Vite-served JS/CSS in a Shopify dev theme. No HMR fanciness yet, no schemas, no types. Just barrel-parity.

- [ ] `@alambic/adapters` — contract types only, no implementations.
- [ ] `@alambic/core` — Vite plugin that:
  - Detects entry points by convention.
  - Generates a `vite-tag.liquid` equivalent (`alambic-asset.liquid`).
  - Spawns `shopify theme dev` and proxies through Vite.
- [ ] `@alambic/preset-tailwind-alpine` — Tailwind v4 + Alpine wired through the adapter contract.
- [ ] `@alambic/cli` — `alambic dev`, `alambic build`.
- [ ] `examples/tailwind-alpine-theme/` — a working theme to test against.
- [ ] `create-alambic` — first version, copies the example theme.

**Definition of done:** `pnpm create alambic test-theme && cd test-theme && pnpm dev` shows the storefront with Vite-served assets and basic CSS HMR. `pnpm build && shopify theme push` produces a working theme.

---

## Phase 2 — Schemas and types (0.2.0)

**Goal:** TS-authored section schemas, end-to-end type generation, the editor lights up.

- [ ] `@alambic/schema` — DSL, presets, compiler to Shopify JSON schema.
- [ ] `@alambic/types` — generators for settings, sections, locales.
- [ ] Type-gen watcher integrated into `alambic dev`.
- [ ] `alambic schema check` CLI command.
- [ ] Migrate `examples/tailwind-alpine-theme` to TS schemas.
- [ ] `alambic new section` scaffolder.

**Definition of done:** Editing `sections/x/schema.ts` regenerates `Theme.Section<'x'>` and the editor picks it up within 200ms. Authoring a section setting with a type mismatch fails `vp check`.

---

## Phase 3 — Section-aware HMR (0.3.0)

**Goal:** Editing a `.liquid` file swaps just that section's DOM, preserving state elsewhere.

- [ ] `@alambic/hmr` — protocol, dev-server side, browser client.
- [ ] Integration with Shopify CLI's file-sync events.
- [ ] Fallback to full page reload on any failure, with logged reason.
- [ ] Stress-test against `examples/tailwind-alpine-theme`.

**Definition of done:** Editing a section's `.liquid` updates the DOM in under 500ms on a warm cache. Alpine `x-data` state outside the changed section is preserved. Form input is preserved.

---

## Phase 4 — Islands (0.4.0)

**Goal:** Hydration directives, per-island bundles, hydration manifest.

- [ ] `@alambic/islands` — directives, build-time analysis, runtime client.
- [ ] `{% render 'island' %}` snippet shipped with the package.
- [ ] Per-island chunk emission in Vite build.
- [ ] Hydration manifest injected at runtime.
- [ ] Documented strategies: `load`, `idle`, `visible`, `hover`, `media:(...)`, `none`.

**Definition of done:** A section marked `client:visible` ships zero JS to the page until visible. Lighthouse "Total Blocking Time" on a product page in `examples/` drops measurably vs. Phase 3.

---

## Phase 5 — Per-template manifest, critical CSS, budgets (0.5.0)

**Goal:** Each template loads only what it needs. Critical CSS inlined per template. Budgets enforced.

- [ ] `@alambic/manifest` — template tree resolution, per-template asset graph.
- [ ] Critical CSS extraction integrated with the CssAdapter.
- [ ] `alambic.config.ts` budget definitions.
- [ ] Build fails on budget breach (configurable).
- [ ] `alambic build --report` outputs a per-template breakdown.

**Definition of done:** The product template in `examples/` ships ≤ 50 KB JS and ≤ 30 KB CSS at the network layer. Build fails predictably when a section bloats.

---

## Phase 6 — Test utilities and preview server (0.6.0)

**Goal:** A section preview server (Storybook-for-Liquid), Vitest helpers, Playwright fixtures.

- [ ] `@alambic/test-utils` — preview server, Vitest harness, Playwright fixture for a live preview theme.
- [ ] `alambic preview` CLI command.
- [ ] `*.stories.liquid` convention.
- [ ] Adapter conformance test suite (gates new adapters).

**Definition of done:** A section can be developed in isolation against the preview server. Visual-regression tests can run in CI via the Playwright fixture.

---

## Phase 7 — LSP (0.7.0)

**Goal:** Editor autocompletion, hover, diagnostics, go-to-definition for Liquid.

- [ ] `@alambic/lsp` server.
- [ ] VS Code extension (separate repo, optional dependency).
- [ ] Diagnostics for unknown settings/blocks/locale keys.
- [ ] Completion inside `{{ section.settings.* }}`, `{{ 'key' | t }}`, etc.
- [ ] Go-to-definition: Liquid render call → section's `schema.ts`.

**Definition of done:** A developer typing `section.settings.` in a section's `index.liquid` sees its settings as completion items. Renaming a setting in `schema.ts` flags the orphaned references in Liquid.

---

## Phase 8 — Hardening and 1.0

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
