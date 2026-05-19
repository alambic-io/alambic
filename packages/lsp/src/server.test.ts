/**
 * Wire-protocol smoke test for the LSP server.
 *
 * Sets up two paired in-memory streams (test client ↔ server), wires
 * the server to its end via `createConnection`, and drives the client
 * end with a real LSP `initialize` request. Asserts the server's
 * capabilities response matches what we advertise.
 *
 * This is the only test that exercises the full JSON-RPC wire — the
 * unit tests for completion + diagnostics use pure functions directly.
 */
import { PassThrough } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  createConnection,
  createProtocolConnection,
  InitializeRequest,
  StreamMessageReader,
  StreamMessageWriter,
} from 'vscode-languageserver/node.js';
import { startServer } from './server.js';

const FIXTURE_THEME = new URL('../../schema/__fixtures__/sample-theme/', import.meta.url).pathname;

describe('LSP server (wire protocol)', () => {
  test('responds to initialize with completion + textDocumentSync capabilities', async () => {
    // Paired streams: serverIn ←client writes / serverOut →client reads.
    const serverIn = new PassThrough();
    const serverOut = new PassThrough();

    // Server side reads from serverIn, writes to serverOut.
    const serverConnection = createConnection(
      new StreamMessageReader(serverIn),
      new StreamMessageWriter(serverOut),
    );
    startServer(serverConnection);

    // Client side reads from serverOut, writes to serverIn.
    const client = createProtocolConnection(
      new StreamMessageReader(serverOut),
      new StreamMessageWriter(serverIn),
    );
    client.listen();

    const init = await client.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      clientInfo: { name: 'vitest' },
      capabilities: {},
      rootUri: pathToFileURL(FIXTURE_THEME).href,
      workspaceFolders: [{ uri: pathToFileURL(FIXTURE_THEME).href, name: 'sample-theme' }],
      initializationOptions: { themeRoot: FIXTURE_THEME },
    });

    expect(init.capabilities.completionProvider).toBeDefined();
    expect(init.capabilities.completionProvider?.triggerCharacters).toEqual(['.', "'", '"']);
    expect(init.capabilities.textDocumentSync).toBeDefined();

    client.dispose();
    serverIn.destroy();
    serverOut.destroy();
  });
});
