# Alambic

> A composable, type-safe devkit for Shopify theme development. Built on Shopify CLI and Vite 8.

Alambic refines raw Liquid theme code into a typed, islands-architected, performance-budgeted theme — without leaving the Shopify CLI or Liquid runtime. It's the developer experience of a modern frontend app, applied to Online Store 2.0 themes.

Production output is always a flat Shopify theme directory that `shopify theme push` consumes. There is no app server, no headless rendering, no proprietary runtime.

**Status:** pre-1.0. APIs are subject to change. See [`docs/roadmap.md`](docs/roadmap.md).

---

## What it gives you today

- **TypeScript-authored section + theme-block schemas** — a typed DSL covering every Shopify setting type. Compiles to inlined `{% schema %}` blocks and emits `Theme.Section<'name'>` / `Theme.Block<'name'>` types via `.alambic/types/index.d.ts`.
- **Section-aware hot reload** out of the box — provided by Shopify CLI's own `theme-hot-reload.js`. Sub-second swaps on the local proxy URL (`127.0.0.1:9292`), state outside the changed section preserved.
- **Per-section JS chunking with islands.** Wrap a section in `<alambic-island data-section="x" data-load="visible">`, export `setup(ctx)` from `client.ts`, and that section's JS chunk loads only when the island scrolls into view. Framework-neutral — works with vanilla DOM, Alpine, anything.
- **Per-template asset graph + budgets.** Each template loads only the section chunks it actually needs (via `modulepreload` hints in `alambic-head.liquid`). Set `budgets.perTemplate.jsKb` in your config; build fails or warns on breach.
- **Environment management.** `environments: { dev, preprod, prod }` with `env('SHOPIFY_DEV_STORE')` references resolved via Vite-style `.env.[name][.local]` precedence. `--env <name>` swaps the active env for `dev`/`build`/`push`/`pull`.
- **`alambic pull --env prod --into dev`** — mirror merchant-owned JSON (templates, settings_data, section groups) from one env onto another without touching `src/`.
- **Pluggable runtime stack.** A single adapter contract for CSS + JS runtimes. Default: Tailwind v4 + Alpine. Swap presets without forking.
- **Editor-agnostic Liquid LSP.** Completion for `section.settings.*`, `block.settings.*`, `{{ 'k' | t }}`, `{% render '…' %}`, `{% section '…' %}`. Warnings for unknown locale keys + unknown setting ids. Works in VS Code, Zed, JetBrains (via LSP4IJ), Neovim, Helix, Sublime — anywhere that speaks LSP over stdio. See [`docs/lsp-setup.md`](docs/lsp-setup.md).

## What's coming

- **LSP polish**: hover, go-to-definition, code actions, metaobject completion. The Phase 6-lite implementation covers completion + diagnostics; the rest lands when there's concrete user demand.
- **Phase 7 hardening**: API freeze, perf benchmarks vs. Dawn, external preset to validate the adapter contract.

## What it explicitly does not do

- No headless. Output is a static Shopify theme directory consumed by `shopify theme push`.
- No Hydrogen, Remix, Astro, Next.
- No Shopify app development, no Functions, no Customer Account UI extensions.

If you need any of those, Alambic is not for you.

## Quick start

```bash
pnpm create alambic my-theme
cd my-theme
pnpm install
pnpm dev   # Runs `shopify theme dev` + Vite + Alambic together
```

`pnpm dev` spawns `shopify theme dev --path .alambic/theme` alongside a Vite dev server on `:5173`. The live-synced staging dir mirrors `src/`, schemas inline into the staged Liquid, and Shopify CLI's built-in hot-reload swaps changed sections in place. Visit the local proxy (`127.0.0.1:9292`) — that's the URL with hot-reload wired up.

Other commands:

```bash
alambic build [--env <name>] [--report]   # one-shot build into .alambic/theme/
alambic push [--env <name>] [--no-build]  # build then `shopify theme push`
alambic pull [--env <src>] [--into <tgt>] # mirror merchant-owned JSON between envs
alambic new section <name> [--with-client]
alambic new block <name>
alambic new snippet <name>
alambic new template <name>
alambic types                              # one-shot type gen
alambic schema check                       # validate schemas
alambic doctor                             # workspace + theme health check
```

## Documentation

- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Adapter contract](docs/adapters.md)
- [Conventions](docs/conventions.md)

## Contributing

Read [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md). Contributions are welcome via PR with a changeset.

## License

MIT.
