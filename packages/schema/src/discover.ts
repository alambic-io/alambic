/**
 * Discover and load every section + theme-block schema in a theme.
 *
 * Walks `<themeRoot>/sections/* /schema.ts` and `<themeRoot>/blocks/* /schema.ts`,
 * imports each via `jiti` (so the TypeScript runs without a compile step),
 * and returns the structured definitions.
 *
 * The intentional consumers:
 *   - `@alambic/types` — generates `Theme.Section<H>` / `Theme.Block<H>`.
 *   - `@alambic/lsp` — drives completion + diagnostics for `section.settings.*`.
 *   - `@alambic/core` — already invokes `compileSection` per-file during
 *     staging, so it doesn't strictly need this; but parity with the
 *     above two callers is the reason it lives here, not in either.
 *
 * Discovery is lazy in the sense that nothing is compiled to JSON. The
 * caller decides whether to run `compileSection` / `compileThemeBlock`
 * on each result. This keeps the discovery cost low for tools that only
 * care about handle ↔ definition (e.g. LSP completion).
 *
 * I/O is restricted to:
 *   - One `glob` call (filesystem walk).
 *   - One `jiti.import` per match.
 * Nothing else — no validation, no compilation, no caching.
 */
import { basename, dirname, resolve } from 'node:path';
import { createJiti } from 'jiti';
import { glob } from 'tinyglobby';
import type { SectionDefinition, ThemeBlockDefinition } from './types.js';

export interface DiscoveredSection {
  /** Section handle (folder name, e.g. `featured`). */
  readonly handle: string;
  /** Absolute path to the `schema.ts` file. */
  readonly filePath: string;
  /** The exported `SectionDefinition` (default or named `default` export). */
  readonly definition: SectionDefinition;
}

export interface DiscoveredBlock {
  /** Theme-block handle (folder name, e.g. `badge`). */
  readonly handle: string;
  /** Absolute path to the `schema.ts` file. */
  readonly filePath: string;
  /** The exported `ThemeBlockDefinition`. */
  readonly definition: ThemeBlockDefinition;
}

export interface DiscoveredSchemas {
  readonly sections: ReadonlyArray<DiscoveredSection>;
  readonly blocks: ReadonlyArray<DiscoveredBlock>;
}

export interface DiscoverSchemasOptions {
  /** Author's theme root (the `src/` directory, not the staging dir). */
  readonly themeRoot: string;
}

export async function discoverSchemas(opts: DiscoverSchemasOptions): Promise<DiscoveredSchemas> {
  const themeRoot = resolve(opts.themeRoot);
  const files = await glob(['sections/*/schema.ts', 'blocks/*/schema.ts'], {
    cwd: themeRoot,
    onlyFiles: true,
    absolute: true,
  });

  // jiti needs a unique instance per discovery call so the module cache
  // doesn't carry across rebuilds. The watcher (in @alambic/core) makes
  // hundreds of these per session — sharing the cache would mean stale
  // schemas after the user edits `schema.ts`.
  const jiti = createJiti(themeRoot, { fsCache: false, moduleCache: false });

  const sections: DiscoveredSection[] = [];
  const blocks: DiscoveredBlock[] = [];

  for (const file of files) {
    const handle = basename(dirname(file));
    let mod: unknown;
    try {
      mod = await jiti.import(file);
    } catch (err) {
      throw new Error(`Failed to import schema ${file}: ${(err as Error).message}`);
    }
    const def = extractDefault(mod);
    if (!def) continue;

    if (file.includes('/sections/') && def.kind === 'section') {
      sections.push({ handle, filePath: file, definition: def as SectionDefinition });
    } else if (file.includes('/blocks/') && def.kind === 'theme-block') {
      blocks.push({ handle, filePath: file, definition: def as ThemeBlockDefinition });
    }
  }

  // Stable order — both callers (types-gen and LSP) benefit from
  // deterministic output.
  sections.sort((a, b) => a.handle.localeCompare(b.handle));
  blocks.sort((a, b) => a.handle.localeCompare(b.handle));
  return { sections, blocks };
}

function extractDefault(mod: unknown): { kind?: string } | null {
  if (!mod || typeof mod !== 'object') return null;
  const m = mod as { default?: unknown; kind?: unknown };
  // schema.ts files use `export default section({...})`. jiti unwraps
  // ESM defaults; if that fails we accept a self-defaulted object.
  const def = (typeof m.default === 'object' && m.default !== null ? m.default : m) as {
    kind?: string;
  };
  if (typeof def.kind !== 'string') return null;
  return def;
}
