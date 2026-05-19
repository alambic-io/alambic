export { startServer, type ServerHandle, type ServerInitOptions } from './server.js';
export { buildThemeIndex, type ThemeIndex } from './index/theme.js';
export { detectContext, type LiquidContext } from './context.js';
export {
  findCompletionContext,
  findLocaleReferences,
  findSettingReferences,
  leadingExpression,
  type CompletionContext,
  type LocaleReference,
  type SettingReference,
} from './parse/liquid-patterns.js';
export { computeCompletions, type ComputeCompletionsOptions } from './features/completion.js';
export { computeDiagnostics, type ComputeDiagnosticsOptions } from './features/diagnostics.js';

/**
 * Convenience re-exports so callers (the alambic CLI's `lsp` command,
 * third-party hosts) don't need to reach past `@alambic/lsp` to import
 * the underlying runtime helpers. The shape mirrors the upstream API.
 */
export {
  createConnection,
  ProposedFeatures,
  StreamMessageReader,
  StreamMessageWriter,
} from 'vscode-languageserver/node.js';
