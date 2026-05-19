/**
 * Theme-wide index used by the LSP server.
 *
 * Holds the structured data the LSP needs to answer completion +
 * diagnostic queries:
 *   - Every section's schema (handle → settings + blocks).
 *   - Every theme block's schema.
 *   - All locale keys (storefront + schema).
 *   - Every snippet file in `snippets/` (just the names — no content).
 *
 * One instance per workspace. Refreshed on initialize and after the
 * client notifies us of a relevant file change.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  type DiscoveredBlock,
  type DiscoveredSection,
  discoverSchemas,
} from '@alambic/schema/discover';
import { type LoadedLocales, loadLocales } from '@alambic/schema/locales';

export interface ThemeIndex {
  /** The theme root the index was built against (absolute). */
  readonly themeRoot: string;
  /** Map of section handle → discovered section schema. */
  readonly sections: ReadonlyMap<string, DiscoveredSection>;
  /** Map of theme-block handle → discovered block schema. */
  readonly blocks: ReadonlyMap<string, DiscoveredBlock>;
  /** Loaded locales (default, schema, allKeys, allSchemaKeys). */
  readonly locales: LoadedLocales;
  /** Snippet names (without `.liquid`), used for `{% render '…' %}`. */
  readonly snippets: ReadonlyArray<string>;
  /**
   * Last build's per-source errors, keyed by absolute file path. Today
   * only schema-import failures are captured here. The LSP surfaces
   * these as workspace diagnostics on the offending file.
   */
  readonly errors: ReadonlyMap<string, string>;
}

const EMPTY_INDEX = (themeRoot: string): ThemeIndex => ({
  themeRoot,
  sections: new Map(),
  blocks: new Map(),
  locales: { entries: [], defaultLocale: null, allKeys: [], allSchemaKeys: [] },
  snippets: [],
  errors: new Map(),
});

/**
 * Build a fresh index from disk. Tolerant of partial failures — a broken
 * schema doesn't crash the LSP; it's surfaced via diagnostics.
 */
export async function buildThemeIndex(themeRoot: string): Promise<ThemeIndex> {
  const root = resolve(themeRoot);
  if (!existsSync(root)) return EMPTY_INDEX(root);

  const errors = new Map<string, string>();

  let sections: ReadonlyArray<DiscoveredSection> = [];
  let blocks: ReadonlyArray<DiscoveredBlock> = [];
  try {
    const discovered = await discoverSchemas({ themeRoot: root });
    sections = discovered.sections;
    blocks = discovered.blocks;
  } catch (err) {
    // `discoverSchemas` throws when a single schema.ts fails to import.
    // The message includes the file path — extract it and stash on the
    // error map so the diagnostics layer can render it on the right file.
    const msg = (err as Error).message;
    const m = /Failed to import schema (.+?):/.exec(msg);
    if (m?.[1]) errors.set(m[1], msg);
  }

  let locales: LoadedLocales;
  try {
    locales = await loadLocales({ themeRoot: root });
  } catch (err) {
    locales = { entries: [], defaultLocale: null, allKeys: [], allSchemaKeys: [] };
    const msg = (err as Error).message;
    const m = /Failed to parse locale (.+?):/.exec(msg);
    if (m?.[1]) errors.set(m[1], msg);
  }

  const snippets = discoverSnippets(root);

  const sectionMap = new Map(sections.map((s) => [s.handle, s] as const));
  const blockMap = new Map(blocks.map((b) => [b.handle, b] as const));

  return {
    themeRoot: root,
    sections: sectionMap,
    blocks: blockMap,
    locales,
    snippets,
    errors,
  };
}

function discoverSnippets(themeRoot: string): string[] {
  const dir = join(themeRoot, 'snippets');
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.liquid') && !f.startsWith('.'))
      .map((f) => f.slice(0, -'.liquid'.length))
      .sort();
  } catch {
    return [];
  }
}
