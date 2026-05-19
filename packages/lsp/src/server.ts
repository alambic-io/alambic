/**
 * Alambic Liquid Language Server.
 *
 * Editor-agnostic LSP server. Speaks the Language Server Protocol over
 * stdio (the universal contract every major editor implements). Any
 * LSP-aware editor — VS Code, Zed, JetBrains via LSP4IJ, Neovim's
 * built-in LSP, Helix, Sublime — can drive it.
 *
 * The server is intentionally narrow in Phase 6-lite:
 *   - Discover schemas / locales / snippets from the workspace on init.
 *   - Provide completion for the four highest-value patterns:
 *       section.settings.X, block.settings.X, `'k' | t`, render names.
 *   - Diagnose unknown locale keys + unknown setting ids per file.
 *
 * Not provided yet (deferred until a real user asks):
 *   - Hover info, go-to-definition, rename, code actions.
 *   - Cross-file references.
 *   - Workspace-wide rename / refactor.
 *   - Theme-check-level Liquid diagnostics (Shopify's
 *     `@shopify/theme-check-*` already does this — we deliberately
 *     don't reimplement it; consumers run both LSPs side-by-side).
 *
 * The completion + diagnostics logic itself lives in `features/` as
 * pure functions so they can be unit-tested without standing up a
 * Connection or paired Duplex streams.
 */
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type Connection,
  type InitializeParams,
  type InitializeResult,
  type ServerCapabilities,
  TextDocumentSyncKind,
  TextDocuments,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { computeCompletions } from './features/completion.js';
import { computeDiagnostics } from './features/diagnostics.js';
import { buildThemeIndex, type ThemeIndex } from './index/theme.js';

export interface ServerInitOptions {
  /** Override theme root. Falls back to a workspace heuristic, then to a per-file heuristic on first open. */
  readonly themeRoot?: string;
}

export interface ServerHandle {
  /** Currently-loaded theme index. Updated by `refreshIndex()`. */
  index(): ThemeIndex | null;
  /** Reload the index from disk. */
  refreshIndex(): Promise<void>;
}

/**
 * Register all handlers on a Connection. Returns a small handle the CLI
 * uses to trigger an index refresh on file watcher events.
 */
export function startServer(connection: Connection): ServerHandle {
  const documents = new TextDocuments(TextDocument);
  let index: ThemeIndex | null = null;
  let themeRoot: string | null = null;

  function log(line: string): void {
    // `console.info` goes to the LSP log channel (visible via
    // `dev: open language server logs` in Zed, "Output" in VS Code, etc.).
    connection.console.info(`[alambic-lsp] ${line}`);
  }

  async function refreshIndex(): Promise<void> {
    if (!themeRoot) {
      log('refreshIndex skipped: no themeRoot resolved yet');
      return;
    }
    index = await buildThemeIndex(themeRoot);
    log(
      `indexed ${index.sections.size} section(s), ${index.blocks.size} block(s), ` +
        `${index.snippets.length} snippet(s), ${index.locales.allKeys.length} locale key(s) ` +
        `from ${themeRoot}`,
    );
    for (const doc of documents.all()) publish(doc);
  }

  function publish(doc: TextDocument): void {
    if (!index) return;
    const diagnostics = computeDiagnostics({ doc, index });
    void connection.sendDiagnostics({ uri: doc.uri, diagnostics });
  }

  /**
   * Fallback: if we don't yet have a usable themeRoot, infer one from
   * the file the user just opened. Walks up looking for a directory that
   * contains a recognized theme subdir (`sections/`, `layout/`, etc.).
   *
   * This is what makes the LSP work even when the editor doesn't send
   * `workspaceFolders`, sends the wrong one (the monorepo root), or
   * when the user just opened a single file with no workspace at all.
   */
  function maybeInferThemeRoot(uri: string): void {
    if (themeRoot && existsSync(themeRoot)) {
      // Sticky once resolved — only re-infer if the open file lives
      // outside the current themeRoot.
      const filePath = safeUriToPath(uri);
      if (filePath && filePath.startsWith(`${themeRoot}/`)) return;
    }
    const inferred = inferThemeRootFromFile(uri);
    if (inferred && inferred !== themeRoot) {
      log(`inferred themeRoot=${inferred} from ${uri}`);
      themeRoot = inferred;
      void refreshIndex();
    }
  }

  connection.onInitialize((params: InitializeParams): InitializeResult => {
    themeRoot = resolveThemeRoot(params);

    const capabilities: ServerCapabilities = {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        triggerCharacters: ['.', "'", '"'],
        resolveProvider: false,
      },
    };
    return { capabilities };
  });

  connection.onInitialized(() => {
    if (themeRoot) {
      log(`themeRoot=${themeRoot} (resolved at initialize)`);
    } else {
      log(
        'no themeRoot resolved at initialize — will infer from the first opened file. ' +
          'Set `initializationOptions.themeRoot` from the client to skip inference.',
      );
    }
    void refreshIndex();
  });

  documents.onDidChangeContent((change) => {
    publish(change.document);
  });

  documents.onDidOpen((change) => {
    maybeInferThemeRoot(change.document.uri);
    publish(change.document);
  });

  connection.onDidChangeWatchedFiles(() => {
    void refreshIndex();
  });

  connection.onCompletion((params) => {
    maybeInferThemeRoot(params.textDocument.uri);
    if (!index) return [];
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return [];
    return computeCompletions({
      uri: params.textDocument.uri,
      text: doc.getText(),
      offset: doc.offsetAt(params.position),
      index,
    });
  });

  documents.listen(connection);
  connection.listen();

  return {
    index: () => index,
    refreshIndex,
  };
}

function resolveThemeRoot(params: InitializeParams): string | null {
  const opts = (params.initializationOptions ?? {}) as ServerInitOptions;
  if (opts.themeRoot) return opts.themeRoot;

  // Prefer workspaceFolders over the deprecated rootUri.
  const folder = params.workspaceFolders?.[0]?.uri ?? params.rootUri ?? null;
  if (!folder) return null;

  const folderPath = URI.parse(folder).fsPath;
  // Prefer `<folder>/src` when it exists (alambic convention).
  // Fall back to the folder itself if it looks like a flat Shopify theme.
  // Otherwise return null and let per-file inference take over once the
  // user opens something.
  if (existsSync(`${folderPath}/src/sections`)) return `${folderPath}/src`;
  if (existsSync(`${folderPath}/sections`)) return folderPath;
  return null;
}

/** Theme subdirs that, when present, mean "this is the theme root". */
const THEME_DIR_MARKERS = ['sections', 'snippets', 'layout', 'blocks', 'templates'];

/**
 * Walk up from a Liquid file's path looking for an ancestor that
 * contains a recognized theme subdir. The first hit is the theme root.
 *
 *   /a/b/c/src/sections/hero/index.liquid → /a/b/c/src
 *   /a/b/c/sections/hero.liquid           → /a/b/c
 *   /a/b/c/layout/theme.liquid            → /a/b/c
 */
function inferThemeRootFromFile(uri: string): string | null {
  const filePath = safeUriToPath(uri);
  if (!filePath) return null;

  let current = dirname(filePath);
  // Hard cap to avoid pathological walks.
  for (let i = 0; i < 12; i++) {
    if (current === dirname(current)) break; // hit filesystem root
    for (const marker of THEME_DIR_MARKERS) {
      if (existsSync(`${current}/${marker}`)) return current;
    }
    current = dirname(current);
  }
  return null;
}

function safeUriToPath(uri: string): string | null {
  try {
    return fileURLToPath(uri);
  } catch {
    return null;
  }
}
