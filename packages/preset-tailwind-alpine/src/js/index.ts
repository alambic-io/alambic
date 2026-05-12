import { fileURLToPath } from 'node:url';
import {
  type AdapterContext,
  type CompiledSection,
  type EntryPoint,
  type JsAdapter,
  defineJsAdapter,
} from '@alambic/adapters';
import { glob } from 'tinyglobby';
import type { Plugin } from 'vite';
import type { AlpineOptions } from '../options.js';

const DEFAULT_ENTRY_PATTERN = 'sections/*/client.{ts,tsx,js}';

/**
 * Alpine.js adapter.
 *
 * Phase 1 scope: discovers `sections/* /client.{ts,tsx,js}` entries and
 * points at the prebuilt browser-side runtime. Per-section binding
 * generation (`generateComponentBindings`) returns a stub until
 * `@alambic/schema` lands.
 */
export function alpine(options: AlpineOptions = {}): JsAdapter {
  const entryPattern = options.entryPattern ?? DEFAULT_ENTRY_PATTERN;

  // The runtime is shipped pre-built alongside this package; consumers
  // import it as `@alambic/preset-tailwind-alpine/runtime`.
  const hydrationRuntime = fileURLToPath(new URL('../runtime.mjs', import.meta.url));

  return defineJsAdapter({
    name: 'alpine',
    hydrationRuntime,

    vitePlugins(_ctx: AdapterContext): Plugin[] {
      return [];
    },

    discoverEntries(ctx: AdapterContext): EntryPoint[] {
      // tinyglobby is async; the contract demands sync. We resolve sync
      // by pre-listing files at config-time via Node's globSync helper.
      // For now, we accept the spec's evolution: contract may move to async.
      // Phase 1 fallback: leave the default convention to @alambic/core.
      const _unused = entryPattern;
      const _ctxCheck = ctx;
      return [];
    },

    generateComponentBindings(_section: CompiledSection): string {
      // Phase 2: emit a typed Alpine `data()` factory from the section's schema.
      return '';
    },
  });
}

/**
 * Async helper, exposed for tooling that wants to use Alpine entry
 * discovery directly without going through the synchronous `JsAdapter`
 * contract. Phase 1 internal use.
 */
export async function alpineEntries(themeRoot: string, pattern?: string): Promise<EntryPoint[]> {
  const files = await glob([pattern ?? DEFAULT_ENTRY_PATTERN], {
    cwd: themeRoot,
    absolute: true,
    onlyFiles: true,
  });
  return files.sort().map((file) => ({
    id: stableId(themeRoot, file),
    file,
    kind: 'section',
  }));
}

function stableId(themeRoot: string, file: string): string {
  const rel = file.startsWith(themeRoot) ? file.slice(themeRoot.length + 1) : file;
  return rel.replace(/\\/g, '/').replace(/\.[^./]+$/, '');
}
