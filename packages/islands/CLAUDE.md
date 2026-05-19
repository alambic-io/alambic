# @alambic/islands

> Per-section JS chunks loaded on demand by a framework-agnostic custom element. Phase 4-lite — the smallest thing that ships zero JS for non-interactive sections.

---

## Purpose

Default Liquid themes fetch and parse all JS on every page. `@alambic/islands` flips that: each section's `client.ts` is a separate chunk, and the runtime hydrates it only when the chunk's host `<alambic-island>` element fires its strategy.

A page with five sections and one interactive `featured` section ships only the featured chunk, and only when the section scrolls into view.

Framework-neutral: a chunk exports a `setup(ctx)` function. What that function does (vanilla DOM, Alpine, htmx, anything) is the section's choice.

## Public API

The package exposes three subpaths:

```ts
// @alambic/islands  — for the orchestrator
export type { IslandManifest, IslandSetup, IslandSetupContext, LoadStrategy } from './types';
export {
  buildManifestToLiquid,
  islandsRuntimeEntryPath,
  renderIslandsSnippet,
  renderIslandsSnippetBuild,
  type IslandsSnippetOptions,
} from './snippets';

// @alambic/islands/runtime  — browser-side, side-effect import
// Defines and auto-registers <alambic-island>. Also exports `registerAlambicIsland()` for tests.

// @alambic/islands/snippets  — re-export of the snippet generators above
```

`islandsRuntimeEntryPath()` returns an absolute filesystem path to the compiled `dist/runtime.mjs` so `@alambic/core` can:
- In dev, read the file and inline it as `<script type="module">…</script>`.
- In build, add it as a Vite rollup `input` entry → `assets/alambic-runtime-<hash>.js`.

## The custom element

Sections opt into hydration by wrapping their root markup:

```liquid
<alambic-island data-section="{{ section.id | replace: 'shopify-section-', '' }}" data-load="visible">
  <section>...</section>
</alambic-island>
```

| Attribute | Required | Meaning |
|---|---|---|
| `data-section` | yes | Manifest key for this section's chunk. Matches the section folder name. |
| `data-load` | no | `eager` (default) or `visible`. |

`eager` hydrates on `connectedCallback`. `visible` installs an `IntersectionObserver` with `rootMargin: 200px` and hydrates on first intersection.

No wrapping snippet is shipped — sections author the tag inline. Liquid snippets can't transparently pass content blocks, so wrapping the element via `{% render %}` would force every section to re-render through a helper, which is more ceremony than value.

## The chunk contract

A section's `client.ts` exports a single `setup` function as its default:

```ts
import type { IslandSetupContext } from '@alambic/islands';

export default function setup(ctx: IslandSetupContext) {
  const btn = ctx.root.querySelector('button');
  btn?.addEventListener('click', () => { /* ... */ });
}
```

`IslandSetupContext`:

```ts
interface IslandSetupContext {
  readonly root: HTMLElement;    // the <alambic-island> element itself
  readonly section: string;      // data-section value
  readonly strategy: LoadStrategy; // 'eager' | 'visible'
}
```

`setup` may be async. Its return value is ignored. Errors are caught and logged via `console.warn` — they don't break the page.

## The hydration manifest

The runtime reads the chunk URL from `window.__alambic.manifest`:

```ts
window.__alambic = {
  manifest: {
    entries: {
      featured: '/assets/sections-featured-client-abc123.js',
      hero:     '/assets/sections-hero-client-def456.js',
    },
  },
};
```

The orchestrator emits this via the `alambic-islands.liquid` snippet:

- **Dev**: inline JSON, URL pointing at Vite (`http://localhost:5173/...`). Runtime is inlined into the same snippet.
- **Build**: Liquid-interpolated URLs (`{{ 'sections-…-client-….js' | asset_url }}`) so Shopify expands them at request time. Runtime is loaded via a separate `<script type="module" src="…asset_url">`.

The snippet is meant to be rendered once in `layout/theme.liquid`:

```liquid
{% render 'alambic-islands' %}
```

## Per-section chunk emission

The orchestrator (`packages/core/src/plugin/index.ts`) discovers every `src/sections/<name>/client.ts` and adds it to Vite's `build.rollupOptions.input` map as `sections/<name>/client`. Rollup naturally produces one chunk per entry. Vite's hashing applies. Shared imports across multiple section chunks end up in a shared chunk by Rollup's default chunking — fine for the lite phase; revisit if islands grow real shared vendor deps.

## Files

```
src/
├── index.ts           # Re-exports types + snippet helpers + runtime path
├── runtime.ts         # AlambicIsland custom element (browser entry)
├── snippets.ts        # Liquid snippet generators (dev + build modes)
└── types.ts           # LoadStrategy, IslandSetupContext, IslandManifest
```

The package builds three entries (`index`, `runtime`, `snippets`) so the runtime can be loaded standalone in the browser without dragging in the snippet generators (which use Node-only string templating).

## Dependencies

- None at runtime. The package is intentionally dependency-free; the orchestrator owns the integration.

`@alambic/core` consumes the snippet generators and the `islandsRuntimeEntryPath()` helper.

## Testing

- `src/snippets.test.ts` — pure function tests for the dev/build snippet renderers, the Liquid escape logic, and the runtime-path helper.
- `src/runtime.test.ts` — happy-dom env. Asserts the custom element auto-registers, warns on missing manifest or `data-section`, defaults to `eager`, installs an `IntersectionObserver` only for `visible`, and tears it down on `disconnectedCallback`.

`IntersectionObserver` is mocked in tests (happy-dom doesn't ship one).

## Claude Code notes

- **Don't add framework integrations here.** The framework choice belongs in a preset (e.g. `preset-tailwind-alpine` could ship an `alpine()` helper that returns a `setup` function). Keep this package framework-neutral.
- **Don't add a strategy until someone needs it.** The Phase 4-full strategies (`idle`, `hover`, `media:(query)`) are deferred. If you add one, follow the existing branch structure in `connectedCallback`; don't introduce a strategy registry abstraction until there are 3+ real ones.
- **The snippet name `alambic-islands.liquid` and `window.__alambic.manifest.entries` shape are public surface.** Changing them needs a changeset.
- **The runtime is meant to stay tiny** (currently ~2.5 KB gzipped). Adding helpers that pull in non-trivial code should land in the section's chunk, not the runtime.
