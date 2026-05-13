import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import type { Logger } from '../logger/index.js';
import { mapFile } from './map.js';

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
 * same path-mapping rules as `buildStaging`.
 *
 * The watcher does NOT do an initial scan — call `buildStaging` first.
 * `ignoreInitial: true` matches that contract.
 */
export function watchStaging(opts: WatchStagingOptions): StagingWatcher {
  const log = opts.logger;

  const watcher: FSWatcher = chokidar.watch('.', {
    cwd: opts.themeRoot,
    ignoreInitial: true,
    ignored: (path: string) => {
      // chokidar passes paths relative to `cwd`. Reject patterns we
      // already know are non-theme noise.
      if (path === '.') return false;
      if (path.startsWith('.git/') || path.startsWith('node_modules/')) return true;
      return false;
    },
  });

  const apply = async (rel: string, kind: 'add' | 'change') => {
    const result = mapFile(rel);
    if (result.kind !== 'mapped') return;
    const src = join(opts.themeRoot, rel);
    const dest = join(opts.output, result.dest);
    try {
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(src, dest);
      log?.debug(`staging ${kind}: ${rel} → ${result.dest}`);
    } catch (err) {
      log?.warn(`staging ${kind} failed for ${rel}: ${(err as Error).message}`);
    }
  };

  const remove = async (rel: string) => {
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
