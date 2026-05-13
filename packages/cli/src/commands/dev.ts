import { alambic, applyEnvFiles, resolveConfig } from '@alambic/core';
import { createServer } from 'vite';
import { loadConfig } from '../internal/load-config.js';

export interface DevOptions {
  cwd: string;
  configPath?: string;
  noShopifyCli?: boolean;
  envName?: string;
}

/**
 * `alambic dev` — load alambic.config.ts, boot a Vite dev server, and
 * (unless `--no-shopify-cli`) spawn `shopify theme dev` as a child
 * process so the storefront preview URL works in parallel.
 *
 * Env files are loaded BEFORE the config is imported, so `env('X')`
 * references resolve correctly. `--env <name>` selects which `.env.[name]`
 * file pair is overlaid on `.env`.
 */
export async function devCommand(options: DevOptions): Promise<void> {
  // First-pass env load (.env + .env.local) so the config import sees them.
  applyEnvFiles(options.cwd, null);

  const { config, cwd } = await loadConfig(options.cwd, options.configPath);

  // Determine the active environment name and reload env files for it.
  const envName = options.envName ?? config.defaultEnvironment ?? null;
  if (envName) {
    applyEnvFiles(cwd, envName);
  }

  const resolved = resolveConfig(
    {
      ...config,
      ...(envName !== null ? { activeEnvironmentName: envName } : {}),
    },
    cwd,
  );

  const server = await createServer({
    configFile: false,
    plugins: alambic({
      ...config,
      noShopifyCli: options.noShopifyCli ?? false,
      ...(envName !== null ? { activeEnvironmentName: envName } : {}),
    }),
  });

  await server.listen();
  server.printUrls();

  if (resolved.activeEnvironmentName) {
    process.stdout.write(`\n  alambic dev — environment: ${resolved.activeEnvironmentName}\n`);
  }
  process.stdout.write(
    `  serving from ${resolved.themeRoot}\n  output target: ${resolved.output}\n`,
  );
}
