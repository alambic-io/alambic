# {{PROJECT_NAME}}

A Shopify theme scaffolded with [Alambic](https://alambic.dev).

## Setup

Copy `.env.example` to `.env.dev.local` and fill in your Shopify dev store + theme ID (if any). The `.local` variants are gitignored; commit non-secret defaults in `.env.[name]` instead.

## Dev

```bash
pnpm dev                # Vite + shopify theme dev (requires `shopify auth login`)
pnpm dev:standalone     # Vite only, no Shopify CLI
pnpm build              # Production build → .alambic/theme/
```

After `pnpm build`: `shopify theme push --path .alambic/theme --theme <id>`.

## Layout

- `src/layout/theme.{liquid,ts,css}` — your theme's root layout. `theme.ts` is the entry that bootstraps Alpine.
- `src/sections/<name>/index.liquid` — sections live in folders. Alambic flattens to `sections/<name>.liquid` in the output. Co-located `.ts`/`.css` files are bundled by Vite.
- `src/snippets/` — Liquid snippets. `alambic-asset.liquid` is auto-generated into `.alambic/theme/snippets/`; don't edit it.
- `src/templates/` — JSON templates.
- `src/config/`, `src/locales/` — Shopify-standard.

`.alambic/theme/` (gitignored) is the live-synced staging dir Shopify CLI reads from.

## License

MIT
