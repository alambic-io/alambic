import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import type { Logger } from '../logger/index.js';
import { mapFile } from './map.js';
import { applySchema } from './schema.js';

export interface WatchStagingOptions {
  themeRoot: string;
  output: string;
  logger?: Logger;
}

export interface StagingWatcher {
  close(): Promise<void>;
}

/**
 * Keep `output` in sync with `themeRoot` as files change. Applies the
 * same path-mapping rules as `buildStaging`, plus schema compilation:
 *
 *   - changes to `sections/<name>/index.liquid` or
 *     `blocks/<name>/index.liquid` re-inline any sibling `schema.ts`
 *   - changes to `schema.ts` re-inline into the destination liquid
 *
 * The watcher does NOT do an initial scan — call `buildStaging` first.
 */
export function watchStaging(opts: WatchStagingOptions): StagingWatcher {
  const log = opts.logger;

  const watcher: FSWatcher = chokidar.watch('.', {
    cwd: opts.themeRoot,
    ignoreInitial: true,
    ignored: (path: string) => {
      if (path === '.') return false;
      if (path.startsWith('.git/') || path.startsWith('node_modules/')) return true;
      return false;
    },
  });

  /** Map a `schema.ts` change back to the index.liquid it co-locates with. */
  function findIndexLiquidFor(rel: string): { sourceRel: string; destRel: string } | null {
    const sec = /^sections\/([^/]+)\/schema\.ts$/.exec(rel);
    if (sec) {
      return { sourceRel: `sections/${sec[1]}/index.liquid`, destRel: `sections/${sec[1]}.liquid` };
    }
    const blk = /^blocks\/([^/]+)\/schema\.ts$/.exec(rel);
    if (blk) {
      return { sourceRel: `blocks/${blk[1]}/index.liquid`, destRel: `blocks/${blk[1]}.liquid` };
    }
    return null;
  }

  const apply = async (rel: string, kind: 'add' | 'change') => {
    // 1. If this is a schema.ts file, re-apply schema to the matching liquid.
    const schemaTarget = findIndexLiquidFor(rel);
    if (schemaTarget) {
      try {
        await applySchema({
          themeRoot: opts.themeRoot,
          outputRoot: opts.output,
          sourceRel: schemaTarget.sourceRel,
          destRel: schemaTarget.destRel,
          ...(log ? { logger: log } : {}),
        });
        log?.info(`schema ${kind}: ${rel}`);
      } catch (err) {
        log?.error(`schema reload failed: ${(err as Error).message}`);
      }
      return;
    }

    // 2. Otherwise, normal file mapping.
    const result = mapFile(rel);
    if (result.kind !== 'mapped') return;
    const src = join(opts.themeRoot, rel);
    const dest = join(opts.output, result.dest);
    try {
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(src, dest);
      log?.debug(`staging ${kind}: ${rel} → ${result.dest}`);

      // If the changed file is a section/block index.liquid AND there's a
      // sibling schema.ts, re-inline it (copyFile just overwrote our work).
      if (
        /^sections\/[^/]+\/index\.liquid$/.test(rel) ||
        /^blocks\/[^/]+\/index\.liquid$/.test(rel)
      ) {
        await applySchema({
          themeRoot: opts.themeRoot,
          outputRoot: opts.output,
          sourceRel: rel,
          destRel: result.dest,
          ...(log ? { logger: log } : {}),
        });
      }
    } catch (err) {
      log?.warn(`staging ${kind} failed for ${rel}: ${(err as Error).message}`);
    }
  };

  const remove = async (rel: string) => {
    // schema.ts unlink leaves the inlined block in place — author can
    // re-inline by editing the index.liquid (which triggers `change`).
    const result = mapFile(rel);
    if (result.kind !== 'mapped') return;
    const dest = join(opts.output, result.dest);
    try {
      await rm(dest, { force: true });
      log?.debug(`staging unlink: ${rel}`);
    } catch (err) {
      log?.warn(`staging unlink failed for ${rel}: ${(err as Error).message}`);
    }
  };

  watcher.on('add', (rel) => {
    void apply(rel, 'add');
  });
  watcher.on('change', (rel) => {
    void apply(rel, 'change');
  });
  watcher.on('unlink', (rel) => {
    void remove(rel);
  });

  return {
    close: async () => {
      await watcher.close();
    },
  };
}
