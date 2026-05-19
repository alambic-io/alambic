# @alambic/manifest

> Per-template asset manifest + performance budgets. Phase 5-lite — the smallest thing that ships per-template-aware preloads and budget enforcement.

---

## Purpose

In a default Liquid theme every page loads the same global bundle. Once per-section client chunks exist (Phase 4-lite islands), `<head>` should announce *which* chunks each template will need, so the browser can start fetching them before scrolling triggers hydration.

`@alambic/manifest` does that, plus budgets:

1. Walk every `templates/<name>.{json,liquid}` in the staging dir to discover which sections each template renders.
2. Cross-reference with the bundle to find each section's `client.ts` chunk and its size.
3. Emit `snippets/alambic-head.liquid` — a single Liquid `case/when` that, per template, emits `<link rel="modulepreload">` tags for the chunks that template will use.
4. Compute per-template JS/CSS totals, compare against a `budgets:` block in `alambic.config.ts`, and either warn or fail the build.
5. Log a table at the end of every build; optionally write `alambic-report.json`.

It's intentionally not invoked directly by end users — `@alambic/core` orchestrates everything.

## Public API

```ts
// Types
export type {
  BudgetBreach,
  BudgetCheckResult,
  BuildManifest,
  PerformanceBudget,
  TemplateAssetGraph,
} from './types';

// Template tree resolver (staging dir → which sections each template renders).
export {
  resolveTemplateTree,
  type ResolvedTemplate,
  type ResolveTemplateTreeOptions,
} from './resolve/template-tree';

// Asset-graph builder (templates + bundle → per-template assets + sizes).
export { buildAssetGraph, type BuildAssetGraphOptions } from './resolve/asset-graph';

// Liquid snippet emitter.
export { renderHeadSnippet } from './emit/head-snippet';

// Budget checking.
export { checkBudgets, type CheckBudgetsOptions } from './budget/check';

// Report formatters (JSON + terminal table).
export {
  renderReportJson,
  renderReportTable,
  type ReportJson,
  type ReportOptions,
} from './emit/report';
```

## What's resolved

- `templates/<name>.json` — parsed; `sections.<id>.type` reads as the section handle.
- `templates/<name>.liquid` — regex-scanned for `{% section 'x' %}` and `{% sections 'group' %}`.
- `sections/<group>.json` — Online Store 2.0 section groups. Resolved when referenced via `{% sections '<group>' %}`.

## What's not resolved (deferred)

- Template suffix variants (`templates/<name>.<suffix>.json` / `.liquid`).
- Conditional sections inside blocks (counted via parent section once).
- App blocks (their JS isn't part of our build).
- Walking Rollup's import graph for shared split chunks. Today only entry-level chunks contribute to "shared JS" totals.

These will land in a Phase 5-full pass if the simple model proves too rough.

## Budget config

```ts
// alambic.config.ts
export default defineConfig({
  budgets: {
    perTemplate: { jsKb: 50, cssKb: 30 },
    perIsland: { jsKb: 20 },
    onBreach: 'warn', // or 'fail'
  },
});
```

Defaults: no budgets enforced unless `budgets` is set. `onBreach` defaults to nothing — explicit `'fail'` is required to abort the build.

## Output: `alambic-head.liquid`

Auto-generated. The consumer's `layout/theme.liquid` includes it once:

```liquid
<head>
  ...
  {% render 'alambic-head', template: template %}
</head>
```

The snippet dispatches on `template.name` (falls back to `template` for older contexts) and emits `<link rel="modulepreload" href="{{ '<chunk>' | asset_url }}">` tags for the section chunks the current template will use.

## Build report (`alambic build --report`)

JSON written to `<output>/../alambic-report.json` (one directory above staging, so Shopify push doesn't grab it):

```json
{
  "templates": [
    {
      "template": "index",
      "jsKb": 46.7,
      "cssKb": 7.3,
      "sections": ["hero", "featured"],
      "sectionChunks": ["sections-featured-client-abc.js"]
    }
  ],
  "budget": { "breaches": [], "shouldFail": false }
}
```

The terminal table is always logged (no flag required):

```
Template   JS       CSS     Sections
─────────  ───────  ──────  ──────────────
404        46.7 KB  7.3 KB  hero
gift_card  46.7 KB  7.3 KB  —
index      46.7 KB  7.3 KB  hero, featured
```

## Internal modules

```
src/
├── index.ts
├── types.ts                      # BuildManifest, TemplateAssetGraph, PerformanceBudget, ...
├── resolve/
│   ├── template-tree.ts          # JSON + Liquid + section-group analysis
│   └── asset-graph.ts            # Section → assets mapping + size aggregation
├── emit/
│   ├── head-snippet.ts           # Generate alambic-head.liquid
│   └── report.ts                 # JSON + terminal report
└── budget/
    └── check.ts                  # Compare manifest totals to budget config
```

Each module is a pure function (no I/O beyond `template-tree.ts` reading files). `@alambic/core` is the only caller in practice; tests exercise each subsystem standalone.

## Dependencies

- None at runtime. The package is dependency-free; `@alambic/core` does all the integration.

## Testing

- `template-tree.test.ts` — parses JSON + Liquid templates + section groups against `mkdtemp` fixtures.
- `asset-graph.test.ts` — section → assets mapping with synthetic vite + islands manifests.
- `head-snippet.test.ts` — Liquid snippet output, escape behavior, empty-manifest case.
- `budget/check.test.ts` — per-template + per-island budgets, pass/fail behavior.
- `report.test.ts` — JSON + table renderer, sort order, breach lines.

## Claude Code notes

- **Don't add a new strategy without a real need.** Phase 5 deferred work (critical CSS, per-template CSS chunking, Rollup import-graph walking) is meaty and only worth landing if the lite version turns out to be insufficient.
- **The snippet name `alambic-head.liquid` is public surface.** Renaming requires a changeset and a migration note.
- **The report JSON shape is intended to be stable.** Adding fields is fine; renaming or removing requires a changeset because CI dashboards may consume it.
- **Don't write per-section CSS handling here yet** — sections don't emit per-section CSS chunks today. Add it when the section pipeline does.
