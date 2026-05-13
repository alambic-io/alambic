import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import type { AdapterContext, EntryPoint } from '@alambic/adapters';
import type { Plugin, ResolvedConfig } from 'vite';
import { resolveConfig as resolveAlambicConfig } from '../config/index.js';
import { environmentToCliFlags } from '../env/index.js';
import { createEventBus, type EventBus } from '../events/index.js';
import { createLogger, type Logger } from '../logger/index.js';
import { buildStaging } from '../staging/build.js';
import { type StagingWatcher, watchStaging } from '../staging/watch.js';
import type { AlambicConfig, AlambicPluginOptions, ResolvedAlambicConfig } from '../types.js';
import { type BuildSnippetOptions, renderBuildSnippet, renderDevSnippet } from './asset-snippet.js';
import { discoverEntries } from './entries.js';
import { spawnShopifyDev, type ShopifyCliHandle } from './shopify-cli.js';

/**
 * The Alambic Vite plugin factory.
 *
 * In dev mode:
 *   1. Builds a staging copy of the theme at `output/` (default
 *      `.alambic/theme/`), flattening nested section folders so the
 *      Shopify CLI accepts the structure.
 *   2. Watches the author's `src/` and mirrors changes into staging.
 *   3. Writes a dev-mode `snippets/alambic-asset.liquid` (inside the
 *      staging dir) pointing at the Vite dev server.
 *   4. Spawns `shopify theme dev --path <stagingDir>` so the storefront
 *      preview reads from staging, not directly from `src/`.
 *
 * In build mode:
 *   1. Runs Vite into `output/assets/` (emitting JS/CSS + manifest).
 *   2. Runs the same staging build into `output/` for all Liquid/JSON.
 *   3. Writes a build-mode `output/snippets/alambic-asset.liquid` with
 *      the production manifest inlined.
 */
export function alambic(input: AlambicPluginOptions | AlambicConfig = {}): Plugin[] {
  const log = createLogger('core');
  const bus = createEventBus();
  const resolved = resolveAlambicConfig(input, process.cwd());
  const options: AlambicPluginOptions = input as AlambicPluginOptions;

  let viteConfig: ResolvedConfig | null = null;
  let entries: EntryPoint[] = [];
  let shopify: ShopifyCliHandle | null = null;
  let stagingWatcher: StagingWatcher | null = null;

  const orchestrator: Plugin = {
    name: 'alambic:orchestrator',
    enforce: 'pre',

    async config(_userConfig, env) {
      entries = await collectEntries(resolved, env.command === 'build' ? 'build' : 'dev', log);

      const buildInput = Object.fromEntries(entries.map((e) => [e.id, e.file]));
      return {
        root: resolved.themeRoot,
        publicDir: false,
        appType: 'custom',
        server: {
          port: resolved.dev.vitePort,
          strictPort: true,
          origin: `http://localhost:${resolved.dev.vitePort}`,
          cors: true,
        },
        build: {
          outDir: join(resolved.output, 'assets'),
          // Shopify requires every asset to live directly in `assets/` (one
          // flat directory). Disable Vite's nested `assets/` prefix.
          assetsDir: '',
          // Staging build owns clearing `output/`; let Vite clear only its
          // own `assets/` subtree.
          emptyOutDir: true,
          manifest: 'alambic-manifest.json',
          rollupOptions: {
            input: buildInput,
            output: {
              entryFileNames: (chunk) => {
                const name = chunk.name.replace(/[/\\]/g, '-');
                return `${name}-[hash].js`;
              },
              chunkFileNames: 'chunk-[name]-[hash].js',
              assetFileNames: (asset) => {
                const name = asset.name?.replace(/[/\\]/g, '-') ?? 'asset';
                return `${name.replace(/\.[^./]+$/, '')}-[hash][extname]`;
              },
            },
          },
        },
        mode: env.mode,
      };
    },

    configResolved(config) {
      viteConfig = config;
    },

    async configureServer(server) {
      log.info(`Vite dev server listening on port ${resolved.dev.vitePort}`);
      await bus.emit('dev:start', { themeRoot: resolved.themeRoot });

      // 1. Build staging from src once.
      await buildStaging({ themeRoot: resolved.themeRoot, output: resolved.output });
      log.info(`Staging built at ${resolved.output}`);

      // 2. Write the dev-mode asset snippet INTO staging.
      await writeAssetSnippet(resolved, {
        mode: 'dev',
        devUrl: `http://localhost:${resolved.dev.vitePort}`,
        entries,
      });

      // 3. Watch src and mirror changes into staging.
      stagingWatcher = watchStaging({
        themeRoot: resolved.themeRoot,
        output: resolved.output,
        logger: log.withTag('staging'),
      });

      if (resolved.dev.spawnShopifyCli && !options.noShopifyCli) {
        try {
          // Point the Shopify CLI at the staging dir, not at `src/`.
          const pathFlag = ['--path', resolved.output];
          const envFlags = environmentToCliFlags(resolved.activeEnvironment);
          const extraArgs = [...pathFlag, ...envFlags, ...resolved.dev.shopifyCliArgs];
          if (resolved.activeEnvironmentName) {
            log.info(
              `Using environment "${resolved.activeEnvironmentName}"${
                resolved.activeEnvironment.store
                  ? ` (store: ${resolved.activeEnvironment.store})`
                  : ''
              }`,
            );
          }
          shopify = spawnShopifyDev({
            themeRoot: resolved.output,
            port: resolved.dev.shopifyPort,
            extraArgs,
            logger: log.withTag('shopify'),
          });
        } catch (err) {
          log.error(err);
        }
      }

      await bus.emit('dev:ready', {
        vitePort: resolved.dev.vitePort,
        shopifyPort: resolved.dev.spawnShopifyCli ? resolved.dev.shopifyPort : null,
      });

      const shutdown = async () => {
        await bus.emit('dev:shutdown', { reason: 'sigint' });
        if (stagingWatcher) await stagingWatcher.close();
        if (shopify) await shopify.shutdown();
        await server.close();
      };
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
    },

    async buildStart() {
      if (viteConfig?.command === 'build') {
        await bus.emit('build:start', {
          themeRoot: resolved.themeRoot,
          outputRoot: resolved.output,
        });
        // Run staging first so when Vite writes into output/assets/, the
        // surrounding theme tree is already in place.
        await buildStaging({
          themeRoot: resolved.themeRoot,
          output: resolved.output,
        });
      }
    },

    async writeBundle(_outOptions, bundle) {
      if (viteConfig?.command !== 'build') return;

      const manifest = buildManifestFromBundle(bundle, entries);
      await writeAssetSnippet(resolved, { mode: 'build', manifest });

      for (const file of Object.keys(bundle)) {
        await bus.emit('build:emit', { file });
      }
      await bus.emit('build:done', { outputRoot: resolved.output, durationMs: 0 });
    },
  };

  const adapterPlugins: Plugin[] = [];
  if (resolved.css || resolved.js) {
    const ctx: AdapterContext = makeAdapterContext({
      resolved,
      logger: log,
      entries,
      mode: 'dev',
    });
    if (resolved.css) adapterPlugins.push(...resolved.css.vitePlugins(ctx));
    if (resolved.js) adapterPlugins.push(...resolved.js.vitePlugins(ctx));
  }

  return [orchestrator, ...adapterPlugins, exposeBusPlugin(bus)];
}

async function collectEntries(
  resolved: ResolvedAlambicConfig,
  mode: 'dev' | 'build',
  logger: Logger,
): Promise<EntryPoint[]> {
  if (resolved.js?.discoverEntries) {
    const ctx: AdapterContext = makeAdapterContext({ resolved, logger, entries: [], mode });
    const fromAdapter = resolved.js.discoverEntries(ctx);
    if (fromAdapter.length > 0) {
      return [...fromAdapter];
    }
  }
  return discoverEntries({ themeRoot: resolved.themeRoot });
}

function makeAdapterContext(args: {
  resolved: ResolvedAlambicConfig;
  logger: Logger;
  entries: ReadonlyArray<EntryPoint>;
  mode: 'dev' | 'build';
}): AdapterContext {
  return {
    mode: args.mode,
    themeRoot: args.resolved.themeRoot,
    outputRoot: args.resolved.output,
    sections: [],
    settings: {},
    logger: args.logger,
  };
}

type WriteSnippetArgs =
  | { mode: 'dev'; devUrl: string; entries: ReadonlyArray<EntryPoint> }
  | { mode: 'build'; manifest: BuildSnippetOptions['manifest'] };

async function writeAssetSnippet(
  resolved: ResolvedAlambicConfig,
  args: WriteSnippetArgs,
): Promise<void> {
  // In both modes, the snippet lives inside `output/` (the staging /
  // build dir). It's the Shopify CLI's view of the theme, not `src/`.
  const target = join(resolved.output, 'snippets', 'alambic-asset.liquid');
  await mkdir(dirname(target), { recursive: true });
  const content =
    args.mode === 'dev'
      ? renderDevSnippet({
          devUrl: args.devUrl,
          entries: args.entries.map((e) => ({
            id: e.id,
            file: relative(resolved.themeRoot, e.file).replace(/\\/g, '/'),
          })),
        })
      : renderBuildSnippet({ manifest: args.manifest });
  await writeFile(target, content, 'utf8');
}

function buildManifestFromBundle(
  bundle: Record<string, unknown>,
  entries: ReadonlyArray<EntryPoint>,
): BuildSnippetOptions['manifest'] {
  const out: Record<string, { js?: string; css: string[] }> = {};
  const entryIds = new Set(entries.map((e) => e.id));

  for (const [fileName, asset] of Object.entries(bundle)) {
    const a = asset as {
      name?: string;
      type?: string;
      isEntry?: boolean;
      viteMetadata?: { importedCss?: Set<string> | string[] };
    };
    if (a.type === 'chunk' && a.isEntry && a.name && entryIds.has(a.name)) {
      const slot = out[a.name] ?? { css: [] };
      slot.js = fileName;
      const css = a.viteMetadata?.importedCss;
      if (css) {
        for (const c of css) slot.css.push(c);
      }
      out[a.name] = slot;
    }
  }

  for (const [fileName, asset] of Object.entries(bundle)) {
    const a = asset as { name?: string; type?: string };
    if (a.type === 'asset' && a.name && fileName.endsWith('.css')) {
      const matched = [...entryIds].find((id) => a.name === id || a.name === `${id}.css`);
      if (matched) {
        const slot = out[matched] ?? { css: [] };
        slot.css.push(fileName);
        out[matched] = slot;
      }
    }
  }

  return out;
}

function exposeBusPlugin(bus: EventBus): Plugin {
  return {
    name: 'alambic:event-bus',
    api: { bus },
  };
}
