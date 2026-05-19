---
'@alambic/schema': minor
'@alambic/types': minor
'@alambic/islands': minor
'@alambic/manifest': minor
'@alambic/core': minor
'@alambic/preset-tailwind-alpine': patch
'@alambic/cli': minor
'create-alambic': patch
---

Phases 2 through 5-lite — schemas, hot-reload + push, islands, per-template manifest + budgets, plus polish.

**Phase 2 (schemas + types)**
- `@alambic/schema`: full TS DSL covering every Shopify setting type (text, range, image_picker, color_scheme_group, metaobject, header/paragraph, ...). Theme blocks via `themeBlock()` + `block.theme()` / `block.app()` / `block.named()` references. Regex-safe `{% schema %}` inliner that respects `{% comment %}` and `{% raw %}` escape contexts. New subpaths: `@alambic/schema/discover` (walks `sections/*/schema.ts` + `blocks/*/schema.ts` and returns structured definitions) and `@alambic/schema/locales` (flatten + load `locales/*.json`).
- `@alambic/types`: discovers schemas via `@alambic/schema/discover` and emits `.alambic/types/index.d.ts` with `Theme.SectionMap` / `Theme.BlockMap` plus the `Shopify.*` runtime objects placeholder namespace.
- `@alambic/core`: staging pipeline inlines compiled schemas into the staged Liquid; watcher reacts to `schema.ts` edits.
- `@alambic/cli`: `alambic types`, `alambic schema check`.

**Phase 3 (HMR + push)**
- HMR via Shopify CLI's built-in `theme-hot-reload.js` (default `--live-reload hot-reload` mode). No custom HMR layer.
- `@alambic/cli`: `alambic push [--env <name>] [--no-build]`.
- Dev defaults: `--nodelete` for safety, `--open` to launch the local proxy URL (which is the URL that gets hot-reload, unlike the myshopify.com share URL).

**Phase 4-lite (islands)**
- `@alambic/islands`: framework-agnostic `<alambic-island data-section data-load>` custom element. Strategies: `eager` and `visible` (IntersectionObserver with rootMargin `200px`). Section `client.ts` becomes its own Rollup entry → one chunk per island. Runtime ships as its own hashed asset (~2.5 KB). `alambic-islands.liquid` snippet rendered once in the layout.

**Phase 5-lite (manifest + budgets)**
- `@alambic/manifest`: template tree resolver (JSON + Liquid + section groups), per-template asset graph, budget checker, JSON + table report.
- `@alambic/core`: emits `snippets/alambic-head.liquid` with `<link rel="modulepreload">` hints per template. Budget check runs at end of every build. `budgets: { perTemplate, perIsland, onBreach }` accepted in `alambic.config.ts`.
- `@alambic/cli`: `alambic build --report` writes `.alambic/alambic-report.json`.

**Polish (post-Phase 5)**
- `@alambic/cli`: `alambic new template <name>` (digit-leading + underscored + dot-suffixed names), `alambic pull [--env <src>] [--into <tgt>] [--only <patterns>] [--dry-run]` for mirroring merchant-owned JSON between envs.
- Doctor: new `Gitignore`, `Shopifyignore`, and `Schema sources` checks.
- `create-alambic`: scaffolds a default `.shopifyignore` covering merchant-owned paths. `@alambic/core` staging copies it into `.alambic/theme/` so `shopify theme push` honors it.
- Environment management: `environments`, `defaultEnvironment`, `env('VAR')`, `--env`, Vite-style `.env.[name][.local]` precedence, `--store-password` mapping.

LSP is Phase 6; hardening + 1.0 is Phase 7.
