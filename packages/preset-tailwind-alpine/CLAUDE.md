# @alambic/preset-tailwind-alpine

> The default Alambic preset. A complete `CssAdapter` + `JsAdapter` pair using Tailwind v4 and Alpine.js.

This is the reference implementation of the adapter contract. Studying its source is the fastest way to understand how to build any other preset.

---

## Purpose

Wire Tailwind v4 and Alpine.js into Alambic via the adapter contract from `@alambic/adapters`. No more, no less. All Tailwind- and Alpine-specific behavior is contained here.

## Public API

```ts
export { tailwindAlpine } from './preset';
export { tailwindCss } from './css';       // CSS adapter standalone
export { alpine } from './js';             // JS adapter standalone
export type { TailwindAlpineOptions } from './options';
```

Usage:

```ts
// alambic.config.ts
import { defineConfig } from '@alambic/core';
import { tailwindAlpine } from '@alambic/preset-tailwind-alpine';

export default defineConfig({
  preset: tailwindAlpine({
    tailwind: {
      // optional overrides
    },
    alpine: {
      plugins: ['intersect', 'focus', 'persist'],
    },
  }),
});
```

Or in pieces:

```ts
import { tailwindCss } from '@alambic/preset-tailwind-alpine/css';
import { alpine } from '@alambic/preset-tailwind-alpine/js';

export default defineConfig({
  css: tailwindCss(),
  js: alpine({ plugins: ['intersect'] }),
});
```

## CSS adapter behavior

- Uses Tailwind v4's official Vite plugin (`@tailwindcss/vite`).
- Content sources: `**/*.liquid`, `**/*.{ts,tsx,js}`, `sections/**/schema.ts`, `locales/**/*.json`.
- Token emission: reads `config/settings_data.json`, converts color/font/spacing tokens to a `@theme` CSS variable block at the top of `tokens.css`.
- Tokens are also re-injected at runtime via a `<style data-alambic-tokens>` block from a Liquid snippet, so merchant edits in the theme customizer update tokens without a rebuild.
- Critical CSS via `@critters` (or successor) configured to inline above-the-fold styles per template.
- Provides custom Tailwind variants:
  - `design-mode:` — active when Shopify theme editor is loaded.
  - `cart-open:` — driven by an `<html data-cart-open>` attribute toggled by an Alpine store.
  - `template-product:`, `template-collection:`, etc. — based on Shopify's body class.

## JS adapter behavior

- Discovers entries by convention: `sections/**/client.ts`. Each entry hydrates the section of the same name.
- Hydration runtime: ~2 KB gzipped, wraps `Alpine.start()` to defer initialization per island.
- Generates per-section Alpine bindings: for each section, emits a typed `data()` factory and `store()` registration scaffolded from the section's schema.
- Alpine plugins are configured per preset instance (default: none beyond `core`). Common plugins are exposed as named strings: `'intersect'`, `'focus'`, `'persist'`, `'mask'`, `'collapse'`.
- Tree-shakes unused Alpine plugins per island.

## Generated component bindings

For each section with a `client.ts`, the preset generates a typed `data()` factory:

```ts
// .alambic/generated/preset-tailwind-alpine/product-card.ts
// alambic:generated @alambic/preset-tailwind-alpine@1.0.0 — do not edit
import type { Theme } from '@alambic/theme-types';

export function productCardData(
  settings: Theme.Section<'product-card'>['settings'],
  blocks: Theme.Section<'product-card'>['blocks'],
) {
  return {
    settings,
    blocks,
    // user-defined methods imported from client.ts
  };
}
```

The user's `client.ts` extends this base:

```ts
import { productCardData } from '../../.alambic/generated/preset-tailwind-alpine/product-card';

export default {
  ...productCardData,
  expanded: false,
  toggle() { this.expanded = !this.expanded; },
};
```

## Internal modules

```
src/
├── index.ts                    # tailwindAlpine() preset factory
├── preset.ts                   # Combines css + js into Preset
├── css/
│   ├── index.ts                # tailwindCss() factory
│   ├── adapter.ts              # CssAdapter implementation
│   ├── tokens.ts               # settings → @theme variables
│   ├── variants.ts             # Custom Tailwind variants
│   └── critical.ts             # Critical CSS via @critters
├── js/
│   ├── index.ts                # alpine() factory
│   ├── adapter.ts              # JsAdapter implementation
│   ├── entries.ts              # Section client.ts discovery
│   ├── bindings.ts             # Typed data() factory generation
│   └── plugins.ts              # Alpine plugin resolution
├── runtime/
│   ├── index.ts                # Browser-side hydration runtime
│   ├── hydrate.ts              # Mount Alpine on an island node
│   └── stores.ts               # Built-in stores: cart, ui
└── snippets/
    └── alambic-tokens.liquid   # Runtime token injection
```

## Dependencies

- `@alambic/adapters` — the contracts.
- `tailwindcss` ^4.0.0 (peer)
- `@tailwindcss/vite` ^4.0.0 (peer)
- `alpinejs` ^3.14.0 (peer)
- `@critters/cli` or successor (runtime)

Peer dependencies keep the consumer in control of versions.

## Testing

- Conformance suite from `@alambic/adapters/conformance` is the primary test. This package must pass it.
- Snapshot tests for token emission against fixture `settings_data.json` files.
- Snapshot tests for generated bindings against fixture section schemas.
- Runtime bundle size assertion: ≤ 3 KB gzipped.
- Integration test: full build of `examples/tailwind-alpine-theme` succeeds and the resulting theme passes Theme Check.

## Claude Code notes

- This is a reference implementation. It's allowed to be slightly more verbose than strictly necessary if that makes it a clearer teaching example. Comment generously.
- When Tailwind v4 or Alpine releases a new minor, run the conformance suite first to catch surprises.
- The runtime is the most performance-sensitive code in the package. Keep it tree-shakeable and avoid eager imports.
- Generated bindings must be deterministic. Test snapshots gate this.
- The custom variants (`design-mode:`, etc.) are documented for users in the package README. Don't add new ones without README + tests.
