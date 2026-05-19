#!/usr/bin/env node
/**
 * `alambic-lsp` — the bin entry point.
 *
 * Spawned by an LSP-aware editor; speaks LSP over stdin/stdout. We
 * default to stdio transport unconditionally — every major editor
 * (VS Code, Zed, JetBrains via LSP4IJ, Neovim's built-in client,
 * Helix, Sublime) launches LSP servers this way. Editors that want a
 * different transport pass `--node-ipc` / `--socket=<port>` and we
 * could honour those later; today the simpler contract is enough.
 */
import {
  createConnection,
  ProposedFeatures,
  StreamMessageReader,
  StreamMessageWriter,
} from 'vscode-languageserver/node.js';
import { startServer } from './server.js';

const connection = createConnection(
  ProposedFeatures.all,
  new StreamMessageReader(process.stdin),
  new StreamMessageWriter(process.stdout),
);
startServer(connection);
