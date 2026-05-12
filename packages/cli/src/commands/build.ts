import { alambic, copyTheme, resolveConfig } from '@alambic/core';
import { build } from 'vite';
import { loadConfig } from '../internal/load-config.js';

export interface BuildOptions {
  cwd: string;
  configPath?: string;
}

/**
 * `alambic build` — runs the Vite build (which emits assets and the
 * manifest snippet via the orchestrator plugin), then copies the
 * static Liquid/JSON parts of the theme into the output directory.
 */
export async function buildCommand(options: BuildOptions): Promise<void> {
  const { config, cwd } = await loadConfig(options.cwd, options.configPath);
  const resolved = resolveConfig(config, cwd);
  const start = Date.now();

  process.stdout.write(`alambic build: ${resolved.themeRoot} → ${resolved.output}\n`);

  await build({
    configFile: false,
    plugins: alambic({ ...config, noShopifyCli: true }),
  });

  const copied = await copyTheme({
    themeRoot: resolved.themeRoot,
    output: resolved.output,
  });

  process.stdout.write(
    `  copied ${copied.length} theme files\n  done in ${Date.now() - start}ms\n`,
  );
}
