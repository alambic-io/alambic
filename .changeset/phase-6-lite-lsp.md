---
'@alambic/lsp': minor
'@alambic/cli': minor
---

Phase 6-lite — editor-agnostic Liquid Language Server.

**New: `@alambic/lsp`**

LSP server over stdio. Speaks the same JSON-RPC contract every major editor implements, so VS Code, Zed, JetBrains (via LSP4IJ), Neovim, Helix, and Sublime can all drive it without a per-editor extension.

Ships as the `alambic-lsp` bin entry and as `alambic lsp` from `@alambic/cli`. Identical behavior.

**Capabilities (shipped):**

- **Completion**:
  - `section.settings.<X>` in a section's `.liquid` → that section's settings (read from `schema.ts`).
  - `block.settings.<X>` in a theme-block's `.liquid` → that block's settings.
  - `'<X>' | t` → all locale keys (default-locale value shown as documentation).
  - `{% render '<X>' %}` → snippet names.
  - `{% section '<X>' %}` → section handles.
- **Diagnostics**:
  - Unknown locale key (warning, code `alambic/unknown-locale-key`).
  - Unknown setting id (warning, code `alambic/unknown-setting`), scoped to the file's schema.

Complementary to `@shopify/theme-check-language-server` — both can run side-by-side; theme-check covers Liquid syntax and Shopify lints, Alambic adds schema/locale/snippet awareness.

**Architecture decisions:**

- Pure handlers (`computeCompletions`, `computeDiagnostics`) in `features/` are unit-tested without standing up a Connection.
- Theme index built once on `initialize` and refreshed on `workspace/didChangeWatchedFiles`. Pulls from `@alambic/schema/discover` (sections + blocks) and `@alambic/schema/locales` (locale keys).
- Regex-based Liquid pattern detection — no AST today. Cheap, simple, slips on multi-line expressions. Upgrade path is `@shopify/liquid-html-parser` when hover/go-to-definition land.

**Deferred (build when a real user asks):**

- Hover info, go-to-definition, code actions, rename.
- Metaobject completion (blocks on Admin API integration).
- Real Liquid parsing.

**Editor setup**: `docs/lsp-setup.md` covers VS Code, Zed, JetBrains, Neovim, Helix, and Sublime Text. Each editor's config is 3-5 lines.

**Bundled Zed extension** (`integrations/zed/`): a thin Rust/WASM extension that registers `alambic-lsp` for the `Liquid` language — Zed (unlike most editors) doesn't accept LSP definitions purely from `settings.json`, so a tiny extension is required. Falls back through user override → PATH → `<workspace>/node_modules/.bin/alambic lsp`. Installed via Zed's `install dev extension` from a local directory.

**Theme-root resolution**: the server tries `initializationOptions.themeRoot`, then `<workspaceFolder>/src` or `<workspaceFolder>` (if either has a `sections/` subdir), then falls back to walking up from the first opened file looking for an ancestor that contains a recognized theme subdir (`sections/`, `layout/`, `snippets/`, `blocks/`, `templates/`). The walker makes the LSP work even when the editor opens a single file with no workspace, or the workspace root isn't the theme root (e.g. dogfooding from a monorepo).
