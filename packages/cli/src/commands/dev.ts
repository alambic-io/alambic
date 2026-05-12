import { alambic, resolveConfig } from '@alambic/core';
import { createServer } from 'vite';
import { loadConfig } from '../internal/load-config.js';

export interface DevOptions {
  cwd: string;
  configPath?: string;
  noShopifyCli?: boolean;
}

/**
 * `alambic dev` — load alambic.config.ts, boot a Vite dev server, and
 * (unless `--no-shopify-cli`) spawn `shopify theme dev` as a child
 * process so the storefront preview URL works in parallel.
 */
export async function devCommand(options: DevOptions): Promise<void> {
  const { config, cwd } = await loadConfig(options.cwd, options.configPath);
  const resolved = resolveConfig(config, cwd);

  const server = await createServer({
    configFile: false,
    plugins: alambic({ ...config, noShopifyCli: options.noShopifyCli ?? false }),
  });

  await server.listen();
  server.printUrls();

  process.stdout.write(
    `\n  alambic dev: serving from ${resolved.themeRoot}\n  output target: ${resolved.output}\n`,
  );
}
