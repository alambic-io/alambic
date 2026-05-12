# Alambic

> A composable, type-safe devkit for Shopify theme development. Built on Shopify CLI and Vite 8.

Alambic refines raw Liquid theme code into a typed, islands-architected, performance-budgeted theme — without leaving the Shopify CLI or Liquid runtime. It's the developer experience of a modern frontend app, applied to Online Store 2.0 themes.

**Status:** pre-1.0. APIs are subject to change. See [`docs/roadmap.md`](docs/roadmap.md).

---

## What it gives you

- **TypeScript-authored section schemas** with a typed DSL that emits both `schema.json` and `Theme.Section<'name'>` types.
- **End-to-end type generation** for theme settings, sections, blocks, metaobjects, metafields, locales, and the Storefront API — a single `.alambic/types/index.d.ts` your editor consumes.
- **Section-aware HMR** via the Shopify Section Rendering API. A section edit re-renders only that section's DOM. Alpine stores, forms, and scroll position survive.
- **Islands architecture for Liquid.** Mark sections as `client:visible`, `client:idle`, `client:hover`, or `client:none`. Hydration runs only where needed.
- **Per-template manifests.** Each template (`product.json`, `collection.json`, …) loads only the JS, CSS, and fonts it actually needs. Critical CSS is inlined per template.
- **Pluggable runtime stack.** A single adapter contract for CSS engines and JS runtimes. Default: Tailwind v4 + Alpine. Swap to UnoCSS, Stimulus, HTMX, or vanilla without forking.
- **A Liquid LSP** that knows your section schemas, theme settings, metaobject definitions, and locale keys.
- **A section preview server** — Storybook for Liquid, driven by `*.stories.liquid` files.

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

`pnpm dev` proxies the Shopify CLI preview and injects Alambic's Vite middleware. You get HMR, type generation in watch mode, schema validation, and the preview server on a single port.

## Documentation

- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Adapter contract](docs/adapters.md)
- [Conventions](docs/conventions.md)

## Contributing

Read [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md). Contributions are welcome via PR with a changeset.

## License

MIT.
