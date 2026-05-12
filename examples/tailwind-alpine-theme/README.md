# tailwind-alpine-theme

Reference Alambic theme using the `@alambic/preset-tailwind-alpine` preset.

## Run locally

From the monorepo root:

```bash
pnpm --filter @examples/tailwind-alpine-theme dev:standalone   # Vite only, no Shopify CLI
pnpm --filter @examples/tailwind-alpine-theme dev              # Vite + shopify theme dev
pnpm --filter @examples/tailwind-alpine-theme build            # Production build → dist/theme/
```

`dev` requires a Shopify dev store and the [Shopify CLI](https://shopify.dev/docs/themes/tools/cli) installed on `$PATH`.

## Layout

```
src/
├── alambic.config.ts
├── layout/theme.liquid     # Renders alambic-asset for layout entries
├── sections/hero/          # One section with an Alpine x-data island
├── snippets/               # alambic-asset.liquid is generated here in dev
├── templates/              # JSON templates referencing sections
├── config/                 # settings_schema, settings_data
└── locales/                # en.default.json
```

After `alambic build`, the consumer-pushable theme lives in `dist/theme/`.
