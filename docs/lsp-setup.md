# Editor setup for `@alambic/lsp`

Alambic ships a Liquid Language Server that adds schema-aware completion and diagnostics to any LSP-aware editor. It's editor-agnostic — every editor below registers it the same way: spawn `alambic-lsp` (or `alambic lsp`), associate it with the `liquid` language id.

The LSP is **complementary** to Shopify's `@shopify/theme-check-language-server`. If you have both registered, both run. Theme-check covers Liquid syntax and Shopify-specific lints; Alambic adds schema, locale-key, and snippet awareness.

---

## Binary

Pick either:

- `alambic-lsp` — installed by `@alambic/lsp`.
- `alambic lsp` — same server, invoked through the main CLI. Use when you already depend on `@alambic/cli`.

Both speak LSP over stdio. No flags needed; the editor sends `initialize` with the workspace folder.

---

## VS Code

Two paths.

### Path A: a custom extension (recommended)

Create a tiny extension that registers a language client. The minimum:

```ts
// extension.ts
import { ExtensionContext } from 'vscode';
import { LanguageClient, ServerOptions, TransportKind } from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export function activate(_ctx: ExtensionContext) {
  const serverOptions: ServerOptions = {
    command: 'alambic-lsp',
    args: [],
    transport: TransportKind.stdio,
  };
  client = new LanguageClient(
    'alambic-lsp',
    'Alambic Liquid LSP',
    serverOptions,
    {
      documentSelector: [{ scheme: 'file', language: 'liquid' }],
      synchronize: {
        fileEvents: [
          // Refresh the theme index whenever schemas, locales, or snippets change.
          // The extension's vscode.workspace.createFileSystemWatcher under the hood.
        ],
      },
    },
  );
  client.start();
}

export function deactivate() {
  return client?.stop();
}
```

`package.json` of the extension declares an activation event on `onLanguage:liquid`. We do not ship a prebuilt VS Code extension yet — it's on the roadmap.

### Path B: a generic LSP client

If you don't want to write an extension, install [`generic-lsp`](https://marketplace.visualstudio.com/items?itemName=llllvvuu.generic-lsp) (or a similar generic LSP bridge) and configure it for the `liquid` language with `alambic-lsp` as the binary.

---

## Zed

Zed doesn't let you register a custom language server purely from `settings.json` — `lsp.<name>` only configures servers Zed already knows about via an extension. We ship a tiny extension in [`integrations/zed/`](../integrations/zed/) that registers `alambic-lsp` for the `Liquid` language.

### Install

Prerequisites:

- A Liquid language extension installed in Zed (`cmd+shift+x` → search "Liquid"). Without it, Zed treats `.liquid` files as plain text and won't fire any LSP. Our extension only provides the language *server*.
- Rust toolchain with `wasm32-wasip2` (`rustup target add wasm32-wasip2`) — Zed compiles dev extensions to WASM on install.

Then:

1. Build the LSP binary in the monorepo: `pnpm install && pnpm vp run -r build`. This produces `packages/lsp/dist/cli.mjs`.
2. In Zed, `cmd+shift+p` → **`zed: install dev extension`** → pick `integrations/zed/` from the monorepo.
3. Open a theme that has `@alambic/lsp` in its `node_modules` (the example theme does, transitively).

The extension finds the binary in this order: `lsp.alambic-lsp.binary.path` setting → `alambic-lsp` on PATH → `<workspace>/node_modules/.bin/alambic-lsp`. Most setups hit the third without any config.

### Optional settings.json tweaks

To register the LSP alongside other Liquid servers (e.g. theme-check):

```jsonc
{
  "languages": {
    "Liquid": {
      "language_servers": ["alambic-lsp", "..."]
    }
  }
}
```

The `"..."` means "keep Zed's other registered Liquid servers". Drop it for "alambic-lsp only".

To pin an explicit binary path (e.g. while developing the LSP itself):

```jsonc
{
  "lsp": {
    "alambic-lsp": {
      "binary": {
        "path": "node",
        "arguments": ["/abs/path/to/packages/lsp/dist/cli.mjs"]
      }
    }
  }
}
```

See `integrations/zed/README.md` for the full reference.

---

## JetBrains (WebStorm, IntelliJ, RubyMine, …)

JetBrains IDEs gained LSP support via the [LSP4IJ](https://plugins.jetbrains.com/plugin/23257-lsp4ij) plugin. Install it, then:

1. **Settings → Languages & Frameworks → Language Servers → Add**.
2. Name: `Alambic Liquid`.
3. Command: `alambic-lsp` (absolute path if not on `PATH`).
4. File patterns: `*.liquid`.
5. Mappings → File name patterns: `*.liquid`, language: `Liquid` (use `Text` if Liquid is unavailable).
6. Apply.

LSP4IJ surfaces completions in the editor and surface diagnostics in the Problems panel.

---

## Neovim (built-in LSP)

```lua
-- ~/.config/nvim/lua/plugins/alambic.lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

if not configs.alambic_lsp then
  configs.alambic_lsp = {
    default_config = {
      cmd = { 'alambic-lsp' },
      filetypes = { 'liquid' },
      root_dir = lspconfig.util.root_pattern('alambic.config.ts', 'alambic.config.js', '.git'),
      settings = {},
    },
  }
end

lspconfig.alambic_lsp.setup({})
```

You'll likely also want to install `nvim-lspconfig` and a completion plugin (`nvim-cmp` etc.). Theme-check can be registered alongside the same way.

---

## Helix

Add to `~/.config/helix/languages.toml`:

```toml
[[language]]
name = "liquid"
language-servers = [{ name = "alambic-lsp" }, { name = "theme-check" }]

[language-server.alambic-lsp]
command = "alambic-lsp"
```

---

## Sublime Text

Install [LSP](https://packagecontrol.io/packages/LSP) from Package Control, then `Preferences → Package Settings → LSP → Settings`:

```jsonc
{
  "clients": {
    "alambic-lsp": {
      "enabled": true,
      "command": ["alambic-lsp"],
      "selector": "text.html.liquid",
    }
  }
}
```

---

## Workspace root

The LSP infers the theme root from the workspace folder the editor sends in `initialize`:

1. If the editor passes `initializationOptions: { themeRoot: '<abs path>' }`, that wins.
2. Otherwise: `${workspaceFolder}/src` if it exists.
3. Otherwise: the workspace folder itself.

The fallback covers plain Shopify themes (no `src/` subdir) and Alambic projects (which use `src/`) without configuration.

## Troubleshooting

- **No completions fire.** Check the LSP is actually running (`ps`, or your editor's LSP panel). Try `alambic-lsp` in a shell — it should sit silent waiting for stdio input. If it errors immediately, `pnpm install` in the project root probably hasn't been run.
- **"Unknown locale key" diagnostics on every key.** The LSP didn't find your `locales/` directory. Check the editor's workspace root matches your theme.
- **`section.settings.X` completion is empty.** Either the file isn't recognized as a section (only `sections/<name>/index.liquid` and `sections/<name>.liquid` are), or `schema.ts` failed to import. Open the LSP's log panel for the actual error.
- **It's slow.** The theme index is built on `initialize` and on file changes. Large themes (200+ sections) may take a second on a cold start. The completion path itself is sync.

## Roadmap

Today: completion + diagnostics for the four highest-value patterns (settings, locale keys, snippets, section names).

Coming when there's concrete demand: hover, go-to-definition, code actions, metaobject completion (needs Admin API integration), rename refactoring.

If a feature is blocking you, file an issue with the specific pattern and an example — that's how priorities get set.
