/**
 * `alambic lsp` — start the Liquid language server over stdio.
 *
 * Equivalent to running the `alambic-lsp` binary that ships with
 * `@alambic/lsp`. Provided here so editors can configure either binary
 * — whichever is on PATH first — and so the documentation can refer to
 * a single `alambic lsp` command in setup snippets.
 *
 * The server speaks LSP/JSON-RPC over stdin/stdout. Don't write any
 * human-readable output here; the editor's parser would choke.
 */
import {
  createConnection,
  ProposedFeatures,
  startServer,
  StreamMessageReader,
  StreamMessageWriter,
} from '@alambic/lsp';

export interface LspCommandOptions {
  /** Optional theme root override. Defaults to what the editor sends in `initialize`. */
  readonly themeRoot?: string;
}

export function lspCommand(_opts: LspCommandOptions = {}): void {
  const connection = createConnection(
    ProposedFeatures.all,
    new StreamMessageReader(process.stdin),
    new StreamMessageWriter(process.stdout),
  );
  startServer(connection);
}
