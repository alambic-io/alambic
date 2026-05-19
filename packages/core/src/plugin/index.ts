import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import type { AdapterContext, EntryPoint } from '@alambic/adapters';
import {
  islandsRuntimeEntryPath,
  renderIslandsSnippet,
  renderIslandsSnippetBuild,
} from '@alambic/islands';
import {
  buildAssetGraph,
  checkBudgets,
  type BuildManifest,
  renderHeadSnippet,
  renderReportJson,
  renderReportTable,
  resolveTemplateTree,
} from '@alambic/manifest';
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

/** Entry id under which the islands runtime is registered in rollupOptions.input. */
const ISLANDS_RUNTIME_ENTRY = 'alambic-runtime';

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

      const buildInput: Record<string, string> = Object.fromEntries(
        entries.map((e) => [e.id, e.file]),
      );
      // Inject the islands runtime as a Vite entry so it ends up as a
      // separately-hashed asset (build) and is HMR-aware (dev).
      buildInput[ISLANDS_RUNTIME_ENTRY] = islandsRuntimeEntryPath();
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

      // 1. Build staging from src once (with schema compilation).
      await buildStaging({
        themeRoot: resolved.themeRoot,
        output: resolved.output,
        logger: log.withTag('staging'),
      });
      log.info(`Staging built at ${resolved.output}`);

      // 2. Write the dev-mode asset snippet INTO staging. Vite's own
      //    `@vite/client` handles JS/CSS HMR; Shopify CLI's built-in
      //    hot-reload (the injected `theme-hot-reload.js`) handles
      //    Liquid section swaps. No custom HMR client needed today.
      await writeAssetSnippet(resolved, {
        mode: 'dev',
        devUrl: `http://localhost:${resolved.dev.vitePort}`,
        entries,
      });
      // Emit `snippets/alambic-islands.liquid` so the layout can render
      // the runtime + per-section JS manifest in one tag.
      await writeIslandsSnippet(resolved, {
        mode: 'dev',
        devUrl: `http://localhost:${resolved.dev.vitePort}`,
        entries,
      });

      // 3. Watch src and mirror changes into staging. The Shopify CLI
      //    watches the staging dir and handles hot-reload itself
      //    (sections + CSS swap, full reload for everything else) via
      //    its `theme-hot-reload.js` injection.
      stagingWatcher = watchStaging({
        themeRoot: resolved.themeRoot,
        output: resolved.output,
        logger: log.withTag('staging'),
      });

      if (resolved.dev.spawnShopifyCli && !options.noShopifyCli) {
        try {
          // Let the Shopify CLI's default `hot-reload` mode handle
          // Liquid section / CSS hot-reload — it has perfect timing
          // (it's in the CLI's own push loop) and ships a working
          // browser script that swaps section DOMs in place.
          //
          // `--nodelete` is safer for dev: only push, never delete
          // remote files. Otherwise the CLI tries to make the dev
          // theme exactly match local, which is destructive when
          // pointing at a theme that already has content.
          //
          // `--open` auto-launches http://127.0.0.1:9292 in the user's
          // browser. The browser tab connects through the CLI's local
          // proxy, which is the URL that has hot-reload wired up —
          // unlike the public `<store>.myshopify.com` share URL.
          const pathFlag = ['--path', resolved.output];
          const safetyFlags = ['--nodelete'];
          const openFlag = resolved.dev.openInBrowser ? ['--open'] : [];
          const envFlags = environmentToCliFlags(resolved.activeEnvironment);
          const extraArgs = [
            ...pathFlag,
            ...safetyFlags,
            ...openFlag,
            ...envFlags,
            ...resolved.dev.shopifyCliArgs,
          ];
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
          log.info(
            `Preview at http://127.0.0.1:${resolved.dev.shopifyPort} ` +
              `— hot-reload only works on this local URL, not on the ` +
              `myshopify.com share URL.`,
          );
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
          logger: log.withTag('staging'),
        });
      }
    },

    async writeBundle(_outOptions, bundle) {
      if (viteConfig?.command !== 'build') return;

      const manifest = buildManifestFromBundle(bundle, entries);
      await writeAssetSnippet(resolved, { mode: 'build', manifest });
      await writeIslandsSnippet(resolved, { mode: 'build', bundle, entries });

      // Per-template manifest (Phase 5). Needs both the bundle (for sizes
      // + section chunks) and the staging dir (for template tree).
      await emitPerTemplateManifest({
        resolved,
        bundle,
        emitReport: Boolean((input as AlambicPluginOptions).emitReport),
        logger: log,
      });

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

type WriteIslandsSnippetArgs =
  | { mode: 'dev'; devUrl: string; entries: ReadonlyArray<EntryPoint> }
  | {
      mode: 'build';
      bundle: Record<string, unknown>;
      entries: ReadonlyArray<EntryPoint>;
    };

/**
 * Emit `<output>/snippets/alambic-islands.liquid`. The layout renders
 * this once; it injects the per-section manifest as inline JSON and
 * loads the islands runtime so `<alambic-island>` elements work.
 */
async function writeIslandsSnippet(
  resolved: ResolvedAlambicConfig,
  args: WriteIslandsSnippetArgs,
): Promise<void> {
  const target = join(resolved.output, 'snippets', 'alambic-islands.liquid');
  await mkdir(dirname(target), { recursive: true });

  if (args.mode === 'dev') {
    const base = `http://localhost:${resolved.dev.vitePort}`.replace(/\/$/, '');
    // In dev, manifest entries are Vite-served paths. Each section's
    // client.ts (named `sections/<name>/client`) maps to its handle.
    const manifestEntries: Record<string, string> = {};
    for (const e of args.entries) {
      const sectionMatch = /^sections\/([^/]+)\/client$/.exec(e.id);
      if (sectionMatch) {
        const handle = sectionMatch[1] as string;
        const file = relative(resolved.themeRoot, e.file).replace(/\\/g, '/');
        manifestEntries[handle] = `${base}/${file}`;
      }
    }
    // Read the compiled runtime and inline it. Small (~3 KB) and saves a
    // separate HTTP request in dev.
    const runtimeSource = await readFile(islandsRuntimeEntryPath(), 'utf8');
    const runtimeTag = `<script type="module">${runtimeSource}</script>`;
    const content = renderIslandsSnippet({
      runtimeScriptTag: runtimeTag,
      manifest: { entries: manifestEntries },
    });
    await writeFile(target, content, 'utf8');
    return;
  }

  // Build mode: walk the bundle, find each section's client chunk + the
  // runtime entry, emit Liquid `asset_url`-resolved URLs.
  const sectionToChunk: Record<string, string> = {};
  let runtimeFile: string | null = null;
  for (const [fileName, asset] of Object.entries(args.bundle)) {
    const a = asset as { name?: string; type?: string; isEntry?: boolean };
    if (a.type !== 'chunk' || !a.isEntry || !a.name) continue;
    const sectionMatch = /^sections\/([^/]+)\/client$/.exec(a.name);
    if (sectionMatch) {
      sectionToChunk[sectionMatch[1] as string] = fileName;
      continue;
    }
    if (a.name === ISLANDS_RUNTIME_ENTRY) {
      runtimeFile = fileName;
    }
  }
  if (!runtimeFile) {
    // No runtime in the bundle (shouldn't happen given we register the
    // entry in config()). Emit an empty marker so the layout's render
    // doesn't 500.
    await writeFile(
      target,
      '{%- comment -%}alambic:generated — no islands runtime emitted{%- endcomment -%}\n',
      'utf8',
    );
    return;
  }
  const content = renderIslandsSnippetBuild({
    runtimeAssetName: runtimeFile,
    manifest: sectionToChunk,
  });
  await writeFile(target, content, 'utf8');
}

/**
 * Emit the per-template manifest:
 *   - Read the staging template tree.
 *   - Map section types → client.ts chunk filenames + sizes from the bundle.
 *   - Compute per-template totals.
 *   - Emit `snippets/alambic-head.liquid` with modulepreload hints.
 *   - Check budgets and log a report.
 *   - Optionally write `alambic-report.json` next to the output root.
 */
async function emitPerTemplateManifest(args: {
  resolved: ResolvedAlambicConfig;
  bundle: Record<string, unknown>;
  emitReport: boolean;
  logger: Logger;
}): Promise<void> {
  const { resolved, bundle, emitReport, logger } = args;

  const templates = await resolveTemplateTree({ themeDir: resolved.output });
  if (templates.length === 0) {
    logger.warn('No templates discovered in staging — skipping per-template manifest.');
    return;
  }

  const sectionChunks: Record<string, string> = {};
  const assetBytes: Record<string, number> = {};
  const sectionChunkBytes: Record<string, number> = {};
  const sharedCss: string[] = [];
  const sharedJs: string[] = [];

  for (const [fileName, asset] of Object.entries(bundle)) {
    const a = asset as {
      type?: string;
      isEntry?: boolean;
      name?: string;
      code?: string;
      source?: string | Uint8Array;
    };
    const bytes = byteSizeOf(a);
    assetBytes[fileName] = bytes;

    if (a.type === 'chunk' && a.isEntry && a.name) {
      const sectionMatch = /^sections\/([^/]+)\/client$/.exec(a.name);
      if (sectionMatch) {
        const handle = sectionMatch[1] as string;
        sectionChunks[handle] = fileName;
        sectionChunkBytes[handle] = bytes;
      } else if (a.name === ISLANDS_RUNTIME_ENTRY) {
        sharedJs.push(fileName);
      } else {
        sharedJs.push(fileName);
      }
    } else if (a.type === 'asset' && fileName.endsWith('.css')) {
      sharedCss.push(fileName);
    }
  }

  const manifest: BuildManifest = buildAssetGraph({
    templates,
    sectionChunks,
    assetBytes,
    sharedCss,
    sharedJs,
  });

  // Write the head snippet into the staging dir's `snippets/`.
  const headSnippetPath = join(resolved.output, 'snippets', 'alambic-head.liquid');
  await mkdir(dirname(headSnippetPath), { recursive: true });
  await writeFile(headSnippetPath, renderHeadSnippet(manifest), 'utf8');

  // Budget check.
  const budgetCheck = checkBudgets({
    manifest,
    budget: resolved.budgets ?? undefined,
    sectionChunkBytes,
  });

  // Console report — always logged so users see what each template costs.
  const table = renderReportTable({ manifest, budgetCheck });
  logger.info(`Per-template manifest:\n${table}`);

  if (budgetCheck.breaches.length > 0) {
    if (budgetCheck.shouldFail) {
      throw new Error(
        `Budget breach (${budgetCheck.breaches.length}). Build failed because ` +
          `\`budgets.onBreach\` is \`'fail'\`.`,
      );
    } else {
      logger.warn(
        `Budget breach (${budgetCheck.breaches.length}). Build continuing because ` +
          `\`budgets.onBreach\` is not \`'fail'\`.`,
      );
    }
  }

  if (emitReport) {
    // One directory above `output` keeps the report out of the staging
    // dir, so `shopify theme push` doesn't try to upload it.
    const reportPath = join(resolved.output, '..', 'alambic-report.json');
    const report = renderReportJson({ manifest, budgetCheck });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    logger.info(`Build report → ${relative(process.cwd(), reportPath)}`);
  }
}

function byteSizeOf(asset: { code?: string; source?: string | Uint8Array }): number {
  if (typeof asset.code === 'string') return Buffer.byteLength(asset.code, 'utf8');
  if (typeof asset.source === 'string') return Buffer.byteLength(asset.source, 'utf8');
  if (asset.source instanceof Uint8Array) return asset.source.byteLength;
  return 0;
}
