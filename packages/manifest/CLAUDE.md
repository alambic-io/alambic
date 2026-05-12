# @alambic/manifest

> Per-template asset manifest, critical CSS extraction, performance budget enforcement.

---

## Purpose

A default Liquid theme loads a global JS bundle and a global CSS bundle on every page. `@alambic/manifest` replaces that with a per-template asset graph: each template (`product.json`, `collection.json`, etc.) loads only the assets actually used by the sections it renders.

It also extracts critical CSS per template and enforces performance budgets at build time.

## Public API

```ts
export { manifestPlugin } from './plugin';
export { type TemplateManifest, type TemplateAssetGraph } from './types';
export { type PerformanceBudget } from './budget';
```

The plugin is consumed by `@alambic/core`. End users interact with it only through:

- The `<head>` snippet (`alambic-head.liquid`) emitted into the consumer theme.
- The `budgets` field in `alambic.config.ts`.
- The build report (`alambic build --report`).

## Algorithm

1. **Resolve template trees.**
   Walk every file under `templates/` (`*.json` and `*.liquid`). For each template, build the section tree: template → section group → sections → blocks. JSON templates reference section handles directly; Liquid templates are statically analyzed for `{% section %}` and `{% sections %}` tags.

2. **Map sections to assets.**
   For each section, look up: its CSS chunk, its island JS chunk (from `@alambic/islands` manifest), its font subsets, its critical image preloads.

3. **Build per-template asset graph.**
   Aggregate per template, dedupe shared assets.

4. **Critical CSS per template.**
   For each template, render a representative HTML against fixture data (provided by the consumer in `test/fixtures/<template>.html` or auto-generated from a smoke render). Extract critical CSS via the configured `CssAdapter.extractCritical`.

5. **Emit the head snippet.**
   `snippets/alambic-head.liquid` contains a Liquid `case` switching on `template` (and `template.suffix` where applicable). Each branch emits the right `<link rel="stylesheet">`, `<link rel="preload">`, and `<script type="module">` tags for that template, plus inlines the critical CSS.

6. **Check budgets.**
   Compare each template's totals against `budgets.perTemplate`. Fail build (or warn, configurable) on breach.

## Output: `alambic-head.liquid`

Auto-generated. The consumer's `layout/theme.liquid` includes it once:

```liquid
<head>
  ...
  {% render 'alambic-head', template: template %}
</head>
```

The snippet handles everything. The consumer never edits it.

## Budget config

```ts
// alambic.config.ts
export default defineConfig({
  budgets: {
    perTemplate: {
      jsKb: 50,
      cssKb: 30,
      fontKb: 80,
      images: { lcpKb: 100 },
    },
    perIsland: {
      jsKb: 20,
    },
    onBreach: 'fail',  // or 'warn'
  },
});
```

Default: `onBreach: 'warn'` in dev, `'fail'` in CI (detected via `CI=true`).

## Build report

`alambic build --report` writes `dist/alambic-report.json` and prints a summary:

```
Template          JS      CSS     Fonts   Critical CSS   Status
─────────────────────────────────────────────────────────────────
index             42 KB   24 KB   62 KB   3.2 KB         ✓
product           58 KB   31 KB   62 KB   4.1 KB         ✗ JS over budget
collection        44 KB   28 KB   62 KB   3.8 KB         ✓
cart              22 KB   18 KB   62 KB   2.1 KB         ✓

Largest islands by template:
  product:    product-gallery   38 KB
  collection: filter-bar        20 KB
```

The JSON output is intended for CI dashboards and Claude Code consumption.

## Internal modules

```
src/
├── index.ts
├── plugin.ts
├── resolve/
│   ├── template-tree.ts        # JSON + Liquid template analysis
│   ├── section-tree.ts         # Section group resolution
│   └── asset-graph.ts          # Section → assets mapping
├── emit/
│   ├── head-snippet.ts         # Generate alambic-head.liquid
│   └── report.ts               # JSON + console report
├── critical/
│   ├── extract.ts              # Wraps adapter.extractCritical
│   └── render-fixture.ts       # Render template against fixture data
├── budget/
│   ├── check.ts
│   └── format.ts
└── types.ts
```

## Dependencies

- `@alambic/core` — Vite plugin contribution, logger.

(Reads the islands manifest emitted to disk by `@alambic/islands`. Reads the adapter's critical CSS function via `AdapterContext`. Neither is a direct package dep — the data flows through filesystem/context.)

## Testing

- Unit tests for template-tree resolution against fixture themes.
- Snapshot tests for emitted `alambic-head.liquid` per fixture.
- Budget check tests against synthetic asset graphs.
- Integration test that builds the example theme and asserts the report matches expectations.

## Claude Code notes

- Template resolution is the trickiest part. Shopify supports `template.suffix` and conditional sections via section groups. The resolver must handle all variants. Read `src/resolve/template-tree.ts` carefully before changing.
- Critical CSS extraction is delegated to the CSS adapter. Don't reimplement it here.
- Budget defaults are intentionally tight. Changing them is a coordinated decision in `docs/conventions.md`.
- When adding a new asset kind (e.g., a new font format), update `TemplateAssetGraph` and the head snippet generator. Keep the snippet output compact — every byte of Liquid is parsed on every request.
