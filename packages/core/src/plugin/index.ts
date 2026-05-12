import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import type { AdapterContext, EntryPoint } from '@alambic/adapters';
import type { Plugin, ResolvedConfig } from 'vite';
import { resolveConfig as resolveAlambicConfig } from '../config/index.js';
import { createEventBus, type EventBus } from '../events/index.js';
import { createLogger, type Logger } from '../logger/index.js';
import type { AlambicConfig, AlambicPluginOptions, ResolvedAlambicConfig } from '../types.js';
import { type BuildSnippetOptions, renderBuildSnippet, renderDevSnippet } from './asset-snippet.js';
import { discoverEntries } from './entries.js';
import { spawnShopifyDev, type ShopifyCliHandle } from './shopify-cli.js';

/**
 * The Alambic Vite plugin factory.
 *
 * In dev mode, configures Vite to serve assets from the theme root,
 * writes a dev-mode `snippets/alambic-asset.liquid` pointing at the Vite
 * dev server, and spawns `shopify theme dev` so the storefront preview
 * URL works in parallel.
 *
 * In build mode, runs Vite's regular build into `output/assets/` and
 * writes a build-mode `output/snippets/alambic-asset.liquid` with the
 * production manifest inlined.
 */
export function alambic(input: AlambicPluginOptions | AlambicConfig = {}): Plugin[] {
  const log = createLogger('core');
  const bus = createEventBus();
  const resolved = resolveAlambicConfig(input, process.cwd());
  const options: AlambicPluginOptions = input as AlambicPluginOptions;

  let viteConfig: ResolvedConfig | null = null;
  let entries: EntryPoint[] = [];
  let shopify: ShopifyCliHandle | null = null;

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
          emptyOutDir: true,
          manifest: 'alambic-manifest.json',
          rollupOptions: {
            input: buildInput,
            output: {
              // Use the entry id as the chunk name so it ends up in the
              // manifest under a stable key.
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

      await writeAssetSnippet(resolved, {
        mode: 'dev',
        devUrl: `http://localhost:${resolved.dev.vitePort}`,
        entries,
      });

      if (resolved.dev.spawnShopifyCli && !options.noShopifyCli) {
        try {
          shopify = spawnShopifyDev({
            themeRoot: resolved.themeRoot,
            port: resolved.dev.shopifyPort,
            extraArgs: resolved.dev.shopifyCliArgs,
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
    // Provisional context — `mode` will be the same instance reused below; we
    // construct one for each command in collectEntries when needed.
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
  const target =
    args.mode === 'dev'
      ? join(resolved.themeRoot, 'snippets', 'alambic-asset.liquid')
      : join(resolved.output, 'snippets', 'alambic-asset.liquid');
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

  // Pure-CSS entries (no JS): the chunk is emitted as an asset with the
  // entry id as `name`. Match those too.
  for (const [fileName, asset] of Object.entries(bundle)) {
    const a = asset as { name?: string; type?: string };
    if (a.type === 'asset' && a.name && fileName.endsWith('.css')) {
      // Asset name might already be in the entryIds set if the entry was a .css file.
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
