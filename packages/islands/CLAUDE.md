# @alambic/islands

> Islands architecture for Shopify themes. Hydration directives, per-island bundles, a tiny runtime that hydrates only what's needed when it's needed.

---

## Purpose

In a default Liquid theme, all JS is fetched and parsed on every page regardless of whether it's needed. `@alambic/islands` flips this: each section declares a hydration strategy, and the runtime hydrates that section's JS only when the strategy fires.

The result: a page with five sections and one interactive product gallery ships only the gallery's JS, and only when the gallery scrolls into view.

## Public API

```ts
export { islandsPlugin } from './plugin';      // Vite plugin contributed to core
export { type HydrationStrategy } from './strategies';
export { type IslandsManifest } from './manifest';
```

Internally there's also the `'island'` Liquid snippet, which is shipped as part of the package output and copied into the consumer theme's `snippets/` directory at build time:

```liquid
{%- comment -%}alambic:generated{%- endcomment -%}
{%- liquid
  assign section = section | default: ''
  assign strategy = strategy | default: 'visible'
-%}
<div
  data-alambic-island
  data-section="{{ section }}"
  data-strategy="{{ strategy }}"
>
  {%- render section -%}
</div>
```

Used in templates as:

```liquid
{% render 'island', section: 'product-gallery', strategy: 'visible' %}
```

## Hydration strategies

| Strategy | Triggers when |
|---|---|
| `load` | Page load (after `DOMContentLoaded`) |
| `idle` | `requestIdleCallback` fires (or polyfilled timeout) |
| `visible` | `IntersectionObserver` reports the island in viewport |
| `hover` | First `pointerenter` or `focusin` on the island |
| `media:(query)` | `matchMedia(query)` is/becomes true |
| `none` | Never. The island ships zero JS. Default for non-interactive sections. |

A section's default strategy is configured in its `schema.ts`:

```ts
export default section({
  name: 'product-gallery',
  hydration: 'visible',           // default
  // ...
});
```

A template can override via the snippet's `strategy:` parameter.

## Per-island bundling

At build time, `islandsPlugin` inspects each section's `client.ts` and produces an isolated chunk per island. Shared dependencies are extracted into a `vendor` chunk (Vite's default behavior, but we configure the boundary).

The output of the build includes:

```
dist/theme/assets/
├── alambic-runtime.[hash].js          # Hydration runtime (~2 KB gzip)
├── alambic-vendor.[hash].js           # Shared dependencies
├── island.product-gallery.[hash].js
├── island.product-card.[hash].js
└── ...
```

## Hydration manifest

At build time, the islands plugin emits a manifest mapping section handles to their chunks and strategies:

```json
{
  "product-gallery": {
    "chunk": "/assets/island.product-gallery.abc123.js",
    "strategy": "visible",
    "css": "/assets/island.product-gallery.abc123.css"
  },
  "product-card": {
    "chunk": "/assets/island.product-card.def456.js",
    "strategy": "none"
  }
}
```

The manifest is consumed by `@alambic/manifest` to produce per-template asset graphs and by the runtime to look up chunks at hydration time.

## Runtime

A small browser script (`runtime/hydrate.ts`, ~2 KB gzip after build). At page load it:

1. Reads the per-template island list from a `<script type="application/json" id="alambic-islands">` block in the page.
2. Sets up the observer/listener for each strategy.
3. When a strategy fires for an island, dynamically imports its chunk and calls the JS adapter's `hydrate(node, exports)` function.

The runtime is JS-adapter-agnostic. The adapter provides the actual `hydrate` function via its `hydrationRuntime` export.

## Internal modules

```
src/
├── index.ts
├── plugin.ts                  # Vite plugin (build-side chunk strategy)
├── strategies.ts              # Strategy types and parsing
├── manifest/
│   ├── index.ts
│   └── emit.ts                # Write the per-page islands manifest
├── runtime/
│   ├── index.ts               # Bundled separately for browser
│   ├── load-strategy.ts
│   ├── idle-strategy.ts
│   ├── visible-strategy.ts
│   ├── hover-strategy.ts
│   └── media-strategy.ts
└── snippets/
    └── island.liquid          # Shipped at build time to consumer theme
```

## Dependencies

- `@alambic/core` — Vite plugin contribution, logger.
- `@alambic/adapters` — calls into `JsAdapter.hydrationRuntime`.

## Testing

- Unit tests for each strategy's trigger logic against jsdom.
- Build test that verifies per-island chunk emission for a fixture theme with 3 sections.
- Manifest snapshot test.
- Runtime bundle size budget in CI: ≤ 3 KB gzipped (leaving 1 KB headroom from the 4 KB conceptual limit).

## Claude Code notes

- Adding a new hydration strategy is the most common change. Pattern: add an entry to the `HydrationStrategy` union, add a file under `runtime/`, register it in `runtime/index.ts`, add a unit test.
- Strategy implementations are isomorphic — they should work the same regardless of the JS adapter being used. Never reach into Alpine-specific APIs from here.
- The runtime is loaded synchronously by default (it's tiny). Don't make it async without a benchmark proving the cost.
- The `island` snippet is part of the public Liquid surface. Changing its parameters or attributes is a breaking change.
