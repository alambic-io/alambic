# {{PROJECT_NAME}}

A Shopify theme scaffolded with [Alambic](https://alambic.dev).

## Dev

```bash
pnpm dev                # Vite + shopify theme dev (requires Shopify CLI auth)
pnpm dev:standalone     # Vite only, no Shopify CLI
pnpm build              # Production build → dist/theme/
```

## Layout

- `src/layout/theme.liquid` — your theme's root layout.
- `src/sections/` — your sections. Each section is a folder with `index.liquid`, optional `client.ts`, optional `index.css`.
- `src/snippets/` — Liquid snippets. `alambic-asset.liquid` is auto-generated; don't edit it.
- `src/templates/` — JSON templates.
- `src/config/`, `src/locales/` — Shopify-standard.

## License

MIT
