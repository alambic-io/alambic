/**
 * Pure diagnostics handler. Given a document + theme index, return the
 * `Diagnostic[]` the LSP should publish for that file.
 */
import { type Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { detectContext } from '../context.js';
import type { ThemeIndex } from '../index/theme.js';
import { findLocaleReferences, findSettingReferences } from '../parse/liquid-patterns.js';
import { inputSettings } from './completion.js';

export interface ComputeDiagnosticsOptions {
  readonly doc: TextDocument;
  readonly index: ThemeIndex;
}

export function computeDiagnostics(opts: ComputeDiagnosticsOptions): Diagnostic[] {
  const { doc, index } = opts;
  const text = doc.getText();
  const out: Diagnostic[] = [];

  // 1) Unknown locale keys.
  const knownLocaleKeys = new Set(index.locales.allKeys);
  if (knownLocaleKeys.size > 0) {
    for (const ref of findLocaleReferences(text)) {
      if (!knownLocaleKeys.has(ref.key)) {
        out.push({
          severity: DiagnosticSeverity.Warning,
          range: {
            start: doc.positionAt(ref.start),
            end: doc.positionAt(ref.end),
          },
          message: `Unknown locale key "${ref.key}".`,
          source: 'alambic',
          code: 'alambic/unknown-locale-key',
        });
      }
    }
  }

  // 2) Unknown setting ids — only when the file has a known schema.
  const fileContext = detectContext({ uri: doc.uri, themeRoot: index.themeRoot });
  if (fileContext.kind === 'section') {
    const section = index.sections.get(fileContext.handle);
    if (section) {
      const known = new Set(inputSettings(section.definition.settings ?? []).map((s) => s.id));
      for (const ref of findSettingReferences(text)) {
        if (ref.scope !== 'section') continue;
        if (!known.has(ref.id)) {
          out.push(
            unknownSetting(doc, ref, `Section "${fileContext.handle}" has no setting "${ref.id}".`),
          );
        }
      }
    }
  } else if (fileContext.kind === 'theme-block') {
    const block = index.blocks.get(fileContext.handle);
    if (block) {
      const known = new Set(inputSettings(block.definition.settings ?? []).map((s) => s.id));
      for (const ref of findSettingReferences(text)) {
        if (ref.scope !== 'block') continue;
        if (!known.has(ref.id)) {
          out.push(
            unknownSetting(doc, ref, `Block "${fileContext.handle}" has no setting "${ref.id}".`),
          );
        }
      }
    }
  }

  return out;
}

function unknownSetting(
  doc: TextDocument,
  ref: { start: number; end: number },
  message: string,
): Diagnostic {
  return {
    severity: DiagnosticSeverity.Warning,
    range: { start: doc.positionAt(ref.start), end: doc.positionAt(ref.end) },
    message,
    source: 'alambic',
    code: 'alambic/unknown-setting',
  };
}
