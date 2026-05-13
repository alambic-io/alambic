import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { glob } from 'tinyglobby';
import { mapFile } from './map.js';

export interface BuildStagingOptions {
  /** Source directory (the author's `src/`). */
  themeRoot: string;
  /** Destination directory (the staging dir / build output). */
  output: string;
  /**
   * Remove `output` before rebuilding. Default: true. Set to `false`
   * when Vite is also writing into the same output (the orchestrator
   * sets emptyOutDir on its own).
   */
  clean?: boolean;
}

/**
 * One-shot transformation of `themeRoot` → `output`. Applies the rules
 * in `./map` and copies each mapped file. Files inside `output/assets/`
 * are preserved across rebuilds in dev (Vite writes there) but cleared
 * during a clean build.
 *
 * Returns the list of destination paths written (relative to `output`).
 */
export async function buildStaging(opts: BuildStagingOptions): Promise<string[]> {
  if (opts.clean !== false) {
    await rm(opts.output, { recursive: true, force: true });
  }
  await mkdir(opts.output, { recursive: true });

  const files = await glob(['**/*'], {
    cwd: opts.themeRoot,
    onlyFiles: true,
    dot: false,
  });

  const written: string[] = [];
  for (const rel of files) {
    const result = mapFile(rel);
    if (result.kind !== 'mapped') continue;
    const src = join(opts.themeRoot, rel);
    const dest = join(opts.output, result.dest);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(src, dest);
    written.push(result.dest);
  }
  return written.sort();
}
