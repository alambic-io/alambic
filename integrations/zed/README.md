# Alambic — Zed extension

A thin Zed extension that registers the `alambic-lsp` Language Server for `.liquid` files. Without it, Zed has no way to spawn our LSP — `lsp.<name>` in `settings.json` only configures servers Zed already knows about.

This extension lives in the Alambic monorepo for now. It's not on the Zed extension registry yet.

---

## Install as a Dev Extension (local)

You need:

- Zed (any recent version).
- The Rust toolchain (`rustup`) plus the `wasm32-wasip2` target:
  ```bash
  rustup target add wasm32-wasip2
  ```
- A Liquid language extension for Zed — the one you install via `cmd+shift+x` → search "Liquid". Our extension provides the language *server* but relies on another extension to register `.liquid` files as the `Liquid` language with a tree-sitter grammar.

Then:

1. Make sure the LSP binary exists. From the alambic monorepo root:
   ```bash
   pnpm install
   pnpm vp run -r build
   ```
   This produces `packages/lsp/dist/cli.mjs` (the `alambic-lsp` binary).

2. In Zed: open the command palette (`cmd+shift+p`) and run **`zed: install dev extension`**. Pick this directory (`integrations/zed/`). Zed compiles the extension to WASM and loads it.

3. Open a theme that has `@alambic/lsp` in its `node_modules` (the example theme does, transitively via `@alambic/cli`):
   ```bash
   zed examples/tailwind-alpine-theme
   ```

4. Open `src/sections/hero/index.liquid`, type `{{ section.settings.` — you should see `heading` as a completion.

If completions don't fire, run `dev: open language server logs` from the palette and look for `alambic-lsp`. Common issues are listed in `docs/lsp-setup.md`.

---

## How it picks the binary

The extension resolves the LSP binary in this order (first match wins):

1. **`lsp.alambic-lsp.binary.path`** in Zed settings — explicit override. Always available as an escape hatch.
2. **`alambic-lsp` on the system PATH** — works if you `pnpm link --global` from `packages/lsp/`.
3. **`alambic` on the system PATH**, with `lsp` as the first argument. `@alambic/cli` exposes the same server via `alambic lsp`.
4. **`<workspace>/node_modules/.bin/alambic lsp`** — returned unconditionally as a last resort. Zed's WASI sandbox doesn't let us check whether files under `node_modules/` exist (Zed excludes them from the worktree view), so we trust the path and let Zed surface a spawn error if it's missing.

Most users hit option 4 without any config. If the workspace root isn't the theme root (e.g. you're inside a monorepo whose root has no `node_modules/.bin/alambic`), use option 1 with an absolute path.

### Settings.json override (option 1)

```jsonc
{
  "lsp": {
    "alambic-lsp": {
      "binary": {
        "path": "/Users/you/path/to/alambic/packages/lsp/dist/cli.mjs"
      }
    }
  }
}
```

If you'd rather invoke node directly (sidesteps shebang/execute-bit issues):

```jsonc
{
  "lsp": {
    "alambic-lsp": {
      "binary": {
        "path": "node",
        "arguments": ["/Users/you/path/to/alambic/packages/lsp/dist/cli.mjs"]
      }
    }
  }
}
```

### Initialization options

Forwarded verbatim to the LSP. Today the only field we read is `themeRoot`:

```jsonc
{
  "lsp": {
    "alambic-lsp": {
      "initialization_options": {
        "themeRoot": "/abs/path/to/src"
      }
    }
  }
}
```

Skip this if `<workspace>/src` is your theme root — the LSP infers that by default.

---

## Building from CI / packaging

For a real release this directory should become its own repo (Zed's extension registry expects one extension per repo). When that happens, the contents stay the same — just lift `integrations/zed/` out, push to GitHub, and submit a PR to `zed-industries/extensions`.
