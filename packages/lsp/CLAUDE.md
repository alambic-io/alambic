# @alambic/lsp

> A Language Server Protocol implementation for Liquid that knows about Alambic schemas, generated types, locale keys, and metaobject definitions.

This package is **phase 7** material. Spec exists so we know where we're going; implementation comes after phases 1–6 land.

---

## Purpose

Stock Liquid tooling treats Liquid as a dumb template language: no autocompletion for settings, no validation against schemas, no go-to-definition. `@alambic/lsp` fills that gap by combining:

- The generated `Theme` namespace from `@alambic/types`.
- Compiled section schemas from `@alambic/schema`.
- Shopify's own `@shopify/theme-check-node` for base Liquid analysis.

The result: type-aware Liquid editing.

## Public API

```ts
export { startServer, type LspServerOptions } from './server';
export { type Capabilities } from './capabilities';
```

Distributed as a standalone binary too: `alambic-lsp` runs the server over stdio. A separate `alambic-vscode` extension (different repo) wraps it for VS Code.

## Capabilities

| Feature | Behavior |
|---|---|
| Completion | `section.settings.` → list of settings from compiled schema. `'key' \| t` → locale keys from generated types. `metaobject.X.` → fields of metaobject `X`. |
| Hover | Show resolved type, label, default. For locale keys, show translation in the default locale. |
| Diagnostics | Unknown setting keys, unknown block keys, unknown locale keys, unknown metaobject handles. Severity: error. |
| Go to definition | From `{% render 'section-name' %}` jumps to that section's `schema.ts`. From `{{ settings.X }}` jumps to `settings_schema.json`. |
| Code actions | "Add setting to schema" when an unknown setting is referenced. "Add locale key" when an unknown translation key is used. |
| Document symbols | Sections, blocks, settings outline in the Liquid file. |
| Folding | Liquid block folding for `{% for %}`, `{% if %}`, `{% comment %}`. |
| Rename | Renaming a setting in `schema.ts` proposes renaming all references in the matching `index.liquid`. |

## Architecture

```
Editor (VS Code)
   │
   │ LSP over stdio
   ▼
┌────────────────────────────────────────────┐
│  @alambic/lsp server                       │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ Liquid parser                        │  │
│  │ (@shopify/theme-check-node engine)   │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ Schema index                         │  │
│  │ Watches sections/*/schema.ts via     │  │
│  │ @alambic/schema's compiler           │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ Type index                           │  │
│  │ Reads .alambic/types/*.d.ts          │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ Locale index                         │  │
│  │ Reads locales/*.json                 │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ Capability handlers                  │  │
│  │ completion, hover, diagnostics,      │  │
│  │ definition, codeActions, rename      │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

## Internal modules

```
src/
├── index.ts
├── server.ts                  # LSP connection setup
├── capabilities/
│   ├── completion.ts
│   ├── hover.ts
│   ├── diagnostics.ts
│   ├── definition.ts
│   ├── code-actions.ts
│   └── rename.ts
├── indexes/
│   ├── schema-index.ts        # sections/*/schema.ts → compiled schemas
│   ├── type-index.ts          # .alambic/types/*.d.ts → resolved Theme namespace
│   ├── locale-index.ts        # locales/*.json
│   └── theme-check.ts         # Wraps @shopify/theme-check-node
├── parsing/
│   └── liquid-cursor.ts       # Locate cursor in Liquid AST for completion context
└── internal/
    └── watch.ts               # File watchers
```

## Dependencies

- `@alambic/schema` — compiled schemas.
- `@alambic/types` — generated types.
- `vscode-languageserver` — LSP runtime.
- `@shopify/theme-check-node` — base Liquid analysis.

## Testing

- Unit tests per capability: synthesize a Liquid document and cursor position, assert the response.
- Integration tests using a real LSP client harness (`vscode-languageserver-testbed` or similar).
- Performance budget: completion must return in < 80ms p95 on a fixture project with 50 sections.

## Claude Code notes

- This package is large and intricate. Don't start work here without reading `docs/architecture.md` § 11 and this file end to end.
- The LSP must tolerate type-gen being stale or absent. Degrade gracefully: still parse Liquid, still flag Shopify-level errors, just skip schema-aware diagnostics.
- File watchers are easy to leak. Use the lifecycle helpers in `src/internal/watch.ts`.
- All capability handlers must be pure given the current indexes. Don't reach back into the filesystem from a handler — that's what the indexes are for.
- The LSP is the killer feature for adoption. Polish matters more than feature count.
