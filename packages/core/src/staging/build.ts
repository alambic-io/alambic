import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { glob } from 'tinyglobby';
import type { Logger } from '../logger/index.js';
import { mapFile } from './map.js';
import { applySchema } from './schema.js';

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
  /** Optional logger for schema-compilation diagnostics. */
  logger?: Logger;
}

/**
 * One-shot transformation of `themeRoot` → `output`. Applies the rules
 * in `./map` and copies each mapped file. For section and theme-block
 * liquid files, also looks for a sibling `schema.ts` and inlines its
 * compiled output as a `{% schema %}` block.
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
  // tinyglobby's `dot: false` excludes our allowlisted root-level dotfiles
  // (`.shopifyignore`). Discover them with a tight second pass so they
  // can pass through `mapFile` like any other theme file.
  const rootDotfiles = await glob(['.shopifyignore'], {
    cwd: opts.themeRoot,
    onlyFiles: true,
    dot: true,
  });
  files.push(...rootDotfiles);

  const written: string[] = [];
  const schemaTargets: Array<{ sourceRel: string; destRel: string }> = [];

  for (const rel of files) {
    const result = mapFile(rel);
    if (result.kind !== 'mapped') continue;
    const src = join(opts.themeRoot, rel);
    const dest = join(opts.output, result.dest);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(src, dest);
    written.push(result.dest);

    // Queue schema application for sections + theme blocks.
    if (
      /^sections\/[^/]+\/index\.liquid$/.test(rel) ||
      /^blocks\/[^/]+\/index\.liquid$/.test(rel)
    ) {
      schemaTargets.push({ sourceRel: rel, destRel: result.dest });
    }
  }

  // Apply schemas AFTER all files are in place (parallel is fine — each
  // target reads/writes a distinct destination file).
  await Promise.all(
    schemaTargets.map((t) =>
      applySchema({
        themeRoot: opts.themeRoot,
        outputRoot: opts.output,
        sourceRel: t.sourceRel,
        destRel: t.destRel,
        ...(opts.logger ? { logger: opts.logger } : {}),
      }),
    ),
  );

  return written.sort();
}
