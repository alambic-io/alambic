# @alambic/preset-tailwind-alpine

> The default Alambic preset: Tailwind v4 + Alpine.js, wired through the adapter contract.

## Install

```bash
pnpm add @alambic/preset-tailwind-alpine tailwindcss @tailwindcss/vite alpinejs
```

## Usage

```ts
// alambic.config.ts
import { defineConfig } from '@alambic/core';
import { tailwindAlpine } from '@alambic/preset-tailwind-alpine';

export default defineConfig({
  preset: tailwindAlpine({
    tailwind: { content: ['extra/**/*.html'] },
    alpine: { plugins: ['intersect', 'persist'] },
  }),
});
```

In your `layout/theme.liquid`:

```liquid
{% render 'alambic-asset', entry: 'runtime' %}
```

This loads the Alpine.js hydration runtime, which auto-starts when the module is loaded in the browser.

## Phase 1 scope

This Phase-1 release wires Tailwind v4's Vite plugin and provides default content sources. Token emission from theme settings, critical CSS extraction, generated Alpine bindings from section schemas, and per-island hydration strategies all land in later phases as `@alambic/schema`, `@alambic/manifest`, and `@alambic/islands` come online.

## License

MIT
