/**
 * Pure completion handler. Takes the cursor context + theme index and
 * returns the LSP `CompletionItem[]` to send to the client.
 *
 * Extracted from the server so it's testable without standing up a
 * Connection or paired Duplex streams.
 */
import { type CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { detectContext } from '../context.js';
import type { ThemeIndex } from '../index/theme.js';
import { findCompletionContext } from '../parse/liquid-patterns.js';

export interface ComputeCompletionsOptions {
  readonly uri: string;
  readonly text: string;
  readonly offset: number;
  readonly index: ThemeIndex;
}

export function computeCompletions(opts: ComputeCompletionsOptions): CompletionItem[] {
  const cursor = findCompletionContext(opts.text, opts.offset);
  if (cursor.kind === 'none') return [];

  const fileContext = detectContext({ uri: opts.uri, themeRoot: opts.index.themeRoot });

  if (cursor.kind === 'section-setting') {
    if (fileContext.kind !== 'section') return [];
    const section = opts.index.sections.get(fileContext.handle);
    if (!section) return [];
    return inputSettings(section.definition.settings ?? []).map((s) =>
      settingItem(s.id, s.type, settingDescription(s)),
    );
  }

  if (cursor.kind === 'block-setting') {
    if (fileContext.kind !== 'theme-block') return [];
    const block = opts.index.blocks.get(fileContext.handle);
    if (!block) return [];
    return inputSettings(block.definition.settings ?? []).map((s) =>
      settingItem(s.id, s.type, settingDescription(s)),
    );
  }

  if (cursor.kind === 'locale-key') {
    return opts.index.locales.allKeys.map((key) => {
      const value = opts.index.locales.defaultLocale?.keys[key];
      return {
        label: key,
        kind: CompletionItemKind.Constant,
        detail: 'locale key',
        ...(value !== undefined ? { documentation: value } : {}),
      };
    });
  }

  if (cursor.kind === 'render') {
    return opts.index.snippets.map((name) => ({
      label: name,
      kind: CompletionItemKind.File,
      detail: 'snippet',
    }));
  }

  if (cursor.kind === 'section-tag') {
    return Array.from(opts.index.sections.keys()).map((handle) => ({
      label: handle,
      kind: CompletionItemKind.Module,
      detail: 'section',
    }));
  }

  return [];
}

function settingItem(
  id: string,
  typeLabel: string,
  description: string | undefined,
): CompletionItem {
  return {
    label: id,
    kind: CompletionItemKind.Field,
    detail: typeLabel,
    ...(description !== undefined ? { documentation: description } : {}),
  };
}

interface SettingLike {
  type?: string;
  id?: string;
  label?: unknown;
  info?: unknown;
}

export function inputSettings(
  settings: ReadonlyArray<unknown>,
): ReadonlyArray<{ id: string; type: string; label?: unknown; info?: unknown }> {
  const out: Array<{ id: string; type: string; label?: unknown; info?: unknown }> = [];
  for (const s of settings) {
    const sl = s as SettingLike;
    if (!sl || typeof sl !== 'object') continue;
    if (sl.type === 'header' || sl.type === 'paragraph') continue;
    if (typeof sl.id !== 'string' || typeof sl.type !== 'string') continue;
    out.push({ id: sl.id, type: sl.type, label: sl.label, info: sl.info });
  }
  return out;
}

function settingDescription(s: { label?: unknown; info?: unknown }): string | undefined {
  const parts: string[] = [];
  if (typeof s.label === 'string') parts.push(`**${s.label}**`);
  if (typeof s.info === 'string') parts.push(s.info);
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}
