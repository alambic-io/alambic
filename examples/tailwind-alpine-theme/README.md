# tailwind-alpine-theme

Reference Alambic theme using the `@alambic/preset-tailwind-alpine` preset.

## Setup

Copy `.env.example` to `.env.dev.local` (and `.env.preprod.local`, `.env.prod.local` as needed) and fill in your Shopify store(s) + theme ID(s).

## Run

From the monorepo root:

```bash
pnpm --filter @examples/tailwind-alpine-theme dev                   # uses defaultEnvironment ('dev')
pnpm --filter @examples/tailwind-alpine-theme dev -- --env preprod  # switch environments
pnpm --filter @examples/tailwind-alpine-theme dev:standalone        # Vite only, no Shopify CLI
pnpm --filter @examples/tailwind-alpine-theme build                 # → .alambic/theme/
```

`dev` requires a Shopify dev store and the [Shopify CLI](https://shopify.dev/docs/themes/tools/cli) installed on `$PATH`. Run `shopify auth login` once to seed the OAuth session.

## Env files (Vite convention)

```
.env                  # always loaded, committed (non-secret defaults)
.env.local            # always loaded, gitignored (secrets fallback)
.env.[name]           # loaded for `--env <name>`, committed
.env.[name].local     # loaded for `--env <name>`, gitignored (per-env secrets)
```

Shell-set env vars (e.g. `SHOPIFY_DEV_STORE=... pnpm dev`) always win over files.

## Layout

```
src/                           # authored, nested
├── layout/theme.{liquid,ts,css}
├── sections/hero/index.liquid  # nested folder — alambic flattens at build/dev
├── templates/                  # JSON templates referencing sections
├── config/                     # settings_schema, settings_data
└── locales/                    # en.default.json

.alambic/theme/                # generated, gitignored — what Shopify CLI sees
├── layout/theme.liquid         # passthrough
├── sections/hero.liquid        # flattened from src/sections/hero/index.liquid
├── snippets/alambic-asset.liquid  # alambic-generated
├── assets/...                  # Vite-built JS/CSS (build mode)
├── config/, locales/, templates/  # passthrough
└── ...
```

Both `alambic dev` and `alambic build` populate `.alambic/theme/`. Dev mode also runs a live watcher that mirrors changes from `src/` → `.alambic/theme/` as you save.

After `alambic build`, the consumer-pushable theme lives in `.alambic/theme/`. To deploy: `shopify theme push --path .alambic/theme --theme <id>` (or wait for Phase 3's `alambic push`).
