import { glob } from 'tinyglobby';
import type { EntryPoint } from '@alambic/adapters';
import { entryIdFor } from '../internal/theme-paths.js';

const DEFAULT_PATTERNS = [
  'sections/*/client.{ts,tsx,js}',
  'sections/*/index.{ts,css}',
  'snippets/*.{ts,css}',
  'layout/*.{ts,css}',
] as const;

export interface DiscoverOptions {
  themeRoot: string;
  /** Override the default convention patterns (relative to themeRoot). */
  patterns?: ReadonlyArray<string>;
}

/**
 * Convention-based entry discovery for the Vite build's rollup input.
 * Each match becomes an `EntryPoint` with a stable `id` derived from its
 * path relative to `themeRoot`.
 */
export async function discoverEntries(options: DiscoverOptions): Promise<EntryPoint[]> {
  const patterns = options.patterns ?? DEFAULT_PATTERNS;
  const files = await glob([...patterns], {
    cwd: options.themeRoot,
    absolute: true,
    onlyFiles: true,
  });

  return files.sort().map((file) => ({
    id: entryIdFor(options.themeRoot, file),
    file,
    kind: classifyKind(file),
  }));
}

function classifyKind(file: string): string {
  if (file.includes('/sections/')) return 'section';
  if (file.includes('/snippets/')) return 'snippet';
  if (file.includes('/layout/')) return 'layout';
  return 'other';
}
