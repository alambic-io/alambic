# @alambic/lsp

> A Liquid Language Server that knows about Alambic schemas, locales, and snippets. Editor-agnostic — speaks LSP over stdio.

---

## Purpose

Stock Liquid tooling treats Liquid as a dumb template language: no autocompletion for settings, no validation against schemas, no quick hint that a `{{ 'key' | t }}` references a non-existent locale key. `@alambic/lsp` fills that gap by reading the same `schema.ts` + `locales/*.json` files Alambic's build pipeline reads, and answering completion + diagnostic queries from any LSP-aware editor.

This is **Phase 6-lite**. Intentionally narrow surface; grows when there's concrete user demand.

## What's NOT in scope (deliberately)

- Liquid grammar parsing and theme-check-style Liquid diagnostics. Shopify already ships `@shopify/theme-check-language-server` for that. Run both LSPs side-by-side — they're complementary, not redundant.
- Hover, go-to-definition, code actions, rename — deferred until a real user asks.
- Metaobject / Admin API integration — needs the Admin API cache (not yet built).
- LSP "workspace symbols" / outline — low value vs. effort.

## Public API

```ts
// Library exports
export { startServer, type ServerHandle, type ServerInitOptions } from './server';
export { buildThemeIndex, type ThemeIndex } from './index/theme';
export { detectContext, type LiquidContext } from './context';
export {
  findCompletionContext, findLocaleReferences, findSettingReferences,
  type CompletionContext, type LocaleReference, type SettingReference,
} from './parse/liquid-patterns';
export { computeCompletions, type ComputeCompletionsOptions } from './features/completion';
export { computeDiagnostics, type ComputeDiagnosticsOptions } from './features/diagnostics';
```

Distributed as a binary too: `alambic-lsp` runs the server over stdio. Identical to `alambic lsp` from the CLI.

## Capabilities (shipped)

| Feature | What it does |
|---|---|
| Completion | `section.settings.<X>` in a section's `.liquid` → that section's settings (from `schema.ts`). `block.settings.<X>` in a theme block's `.liquid` → that block's settings. `'<X>' \| t` → locale keys (from `locales/*.json`). `{% render '<X>' %}` → snippet names. `{% section '<X>' %}` → section handles. |
| Diagnostics | Unknown locale key (warning). Unknown `section.settings.<X>` id in a section file (warning, scoped to that section's schema). Unknown `block.settings.<X>` id in a theme-block file. |
| Document sync | Incremental. |
| Workspace file watching | Listens for `workspace/didChangeWatchedFiles` and refreshes the index. The actual file-watcher registration is the editor's job (most clients send these events for any tracked file). |

## Architecture

```
Editor (VS Code, Zed, JetBrains, Neovim, ...)
   │
   │ LSP over stdio
   ▼
┌────────────────────────────────────────────┐
│  @alambic/lsp                              │
│                                            │
│  src/server.ts                             │
│   ├─ documents (TextDocuments)             │
│   ├─ onCompletion → computeCompletions     │
│   ├─ onDid(Change|Open) → computeDiagnostics│
│   └─ onDidChangeWatchedFiles → refresh     │
│                                            │
│  src/index/theme.ts                        │
│   ├─ @alambic/schema/discover (schemas)    │
│   ├─ @alambic/schema/locales  (locales)    │
│   └─ snippets directory walk               │
│                                            │
│  src/parse/liquid-patterns.ts              │
│   └─ regex-based pattern detection (no AST)│
│                                            │
│  src/context.ts                            │
│   └─ URI → LiquidContext (section/block/…) │
│                                            │
│  src/features/                             │
│   ├─ completion.ts  (pure)                 │
│   └─ diagnostics.ts (pure)                 │
└────────────────────────────────────────────┘
```

Pure functions in `features/` are unit-testable without standing up a Connection or paired Duplex streams. The server is a thin glue layer.

## Internal modules

```
src/
├── index.ts                # Public exports
├── cli.ts                  # `alambic-lsp` bin entry (shebang)
├── server.ts               # Connection setup + LSP handler registration
├── context.ts              # URI → LiquidContext
├── index/
│   └── theme.ts            # Theme-wide index (schemas + locales + snippets)
├── parse/
│   └── liquid-patterns.ts  # Cursor-aware Liquid pattern detection
└── features/
    ├── completion.ts       # computeCompletions(args) → CompletionItem[]
    └── diagnostics.ts      # computeDiagnostics(args) → Diagnostic[]
```

## Dependencies

- `@alambic/schema` — `discoverSchemas`, `loadLocales`, type names.
- `vscode-languageserver` — LSP runtime.
- `vscode-languageserver-textdocument` — incremental document handling.
- `vscode-uri` — URI parsing.

No Shopify Liquid parser yet. We use regex against the text immediately around the cursor (cheap, good for the patterns we currently care about). If we add hover / go-to-definition we'll upgrade to a real Liquid parser (`@shopify/liquid-html-parser` is the obvious candidate).

## Testing

- Unit tests for `liquid-patterns.ts`, `context.ts`, `index/theme.ts`, and both feature modules.
- The features are unit-tested via direct calls to `computeCompletions` + `computeDiagnostics`.
- No end-to-end LSP-over-stdio test today — the pure-handler split makes it unnecessary for the current capability set.

## Per-editor setup

End-user setup snippets for every major editor live in `docs/lsp-setup.md`. Each editor follows the same pattern: register `alambic-lsp` (or `alambic lsp`) as the language server for `*.liquid` files.

## Claude Code notes

- **Don't reach into the filesystem from a handler.** Read from `ThemeIndex`. If you need new data, add it to `buildThemeIndex`.
- **Pure handlers are the contract.** New capabilities go in `features/<name>.ts` as pure functions over `(args, index)`. The server registers them.
- **Don't reimplement what `@shopify/theme-check-language-server` already does.** Liquid syntax errors, undefined filters, deprecated tags — those are theirs. We add schema/locale/snippet awareness on top.
- **Trigger characters matter.** `.`, `'`, `"` are registered. Adding new ones requires testing on every editor — some clients (notably Zed) trigger on far more events than VS Code.
- **The regex parser is intentionally simple.** Multi-line Liquid expressions don't always work. Upgrade to a real parser when needed; don't pile on regex hacks.
