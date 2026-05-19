/*!
 * Zed extension for the Alambic Liquid LSP.
 *
 * Zed requires an extension to register any custom language server —
 * `lsp.<name>.binary` in settings.json is only honored for servers Zed
 * already knows about. This extension declares `alambic-lsp` for the
 * `Liquid` language; the actual LSP binary lives in `@alambic/lsp`.
 *
 * Binary resolution (highest → lowest priority):
 *   1. `lsp.alambic-lsp.binary.path` in the user's Zed settings.json.
 *   2. `alambic-lsp` on the system PATH.
 *   3. `alambic` on the system PATH, with `lsp` as the first argument.
 *      `@alambic/cli` exposes `alambic lsp` which spawns the same server.
 *   4. `<worktree>/node_modules/.bin/alambic lsp` — the common case.
 *      Returned unconditionally as a last resort: Zed's WASI sandbox
 *      doesn't let us check whether files under `node_modules/` exist
 *      (Zed excludes them from the worktree view), so we trust the path
 *      and let Zed surface a spawn error if it isn't actually there.
 *
 * The settings.json override (1) is always available as an escape
 * hatch for non-standard layouts.
 */

use zed_extension_api::{self as zed, settings::LspSettings, LanguageServerId, Result};

struct AlambicExtension;

impl AlambicExtension {
    fn resolve_binary(
        &self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<(String, Vec<String>)> {
        // 1) User-configured override via `lsp.alambic-lsp.binary` in Zed settings.
        if let Ok(settings) = LspSettings::for_worktree(language_server_id.as_ref(), worktree) {
            if let Some(binary) = settings.binary {
                if let Some(path) = binary.path {
                    return Ok((path, binary.arguments.unwrap_or_default()));
                }
            }
        }

        // 2) `alambic-lsp` on the system PATH.
        if let Some(path) = worktree.which("alambic-lsp") {
            return Ok((path, Vec::new()));
        }

        // 3) `alambic` on the system PATH (e.g. `npm install -g @alambic/cli`).
        //    The `alambic lsp` subcommand spawns the same LSP server.
        if let Some(path) = worktree.which("alambic") {
            return Ok((path, vec!["lsp".to_string()]));
        }

        // 4) Last resort: assume the workspace has the binary at the
        //    standard pnpm location and return that path unconditionally.
        //    We can't verify the file exists from inside the WASI sandbox
        //    — Zed's `read_text_file` doesn't see paths under `node_modules/`
        //    (those are excluded from its worktree view by default). If the
        //    file isn't actually there, Zed surfaces a clear spawn error
        //    ("No such file or directory") that points the user the same
        //    direction this error message would.
        Ok((
            format!("{}/node_modules/.bin/alambic", worktree.root_path()),
            vec!["lsp".to_string()],
        ))
    }
}

impl zed::Extension for AlambicExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let (command, args) = self.resolve_binary(language_server_id, worktree)?;
        Ok(zed::Command {
            command,
            args,
            env: Vec::new(),
        })
    }

    fn language_server_initialization_options(
        &mut self,
        server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<zed::serde_json::Value>> {
        // Pass through whatever the user puts in
        // `lsp.alambic-lsp.initialization_options` in settings.json. Our LSP
        // honors `themeRoot` here; everything else is ignored.
        LspSettings::for_worktree(server_id.as_ref(), worktree)
            .map(|s| s.initialization_options.clone())
    }
}

zed::register_extension!(AlambicExtension);
