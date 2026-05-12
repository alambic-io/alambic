---
'@alambic/adapters': minor
'@alambic/core': minor
'@alambic/preset-tailwind-alpine': minor
'@alambic/cli': minor
'create-alambic': minor
---

Phase 1 — minimum viable dev loop.

- `@alambic/adapters`: `CssAdapter`, `JsAdapter`, `Preset` contracts; `AdapterContext`, `EntryPoint`, `CompiledSection`, `ThemeSettings`, `Logger` shared types; `definePreset`/`defineCssAdapter`/`defineJsAdapter` identity helpers.
- `@alambic/core`: `defineConfig`, `resolveConfig`, the `alambic()` Vite plugin (entry discovery, asset-snippet emission in dev and build, Shopify CLI subprocess management), `AlambicError`, `createLogger`, `createEventBus`, `copyTheme`.
- `@alambic/preset-tailwind-alpine`: Phase 1 subset — wires `@tailwindcss/vite` and provides Alpine entry discovery + a 2-line hydration runtime. Token emission, critical CSS, and generated bindings land in later phases.
- `@alambic/cli`: `alambic dev` and `alambic build` commands wired to core.
- `create-alambic`: scaffolder bundling a `tailwind-alpine` template; `pnpm create alambic my-theme` produces a runnable project.

Definition of done from the roadmap (`pnpm dev` shows Vite-served assets in a Shopify dev theme; `pnpm build && shopify theme push` produces a working theme) is locally verified for the build half. The dev half requires a Shopify CLI auth + dev store, which is left to the user to confirm.
