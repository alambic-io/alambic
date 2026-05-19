import { alambic, applyEnvFiles, resolveConfig } from '@alambic/core';
import { build } from 'vite';
import { loadConfig } from '../internal/load-config.js';

export interface BuildOptions {
  cwd: string;
  configPath?: string;
  envName?: string;
  /** Write `<output>/../alambic-report.json` with per-template stats. */
  report?: boolean;
}

/**
 * `alambic build` — invokes the Vite build. The orchestrator plugin
 * runs the staging copy (flattening + passthrough) in `buildStart`
 * and writes the production asset snippet in `writeBundle`. Nothing
 * left to do here besides print stats.
 *
 * `--env <name>` is honored but Phase 1 builds are env-agnostic.
 */
export async function buildCommand(options: BuildOptions): Promise<void> {
  applyEnvFiles(options.cwd, null);

  const { config, cwd } = await loadConfig(options.cwd, options.configPath);

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
  const start = Date.now();

  process.stdout.write(`alambic build: ${resolved.themeRoot} → ${resolved.output}\n`);

  await build({
    configFile: false,
    plugins: alambic({
      ...config,
      noShopifyCli: true,
      ...(envName !== null ? { activeEnvironmentName: envName } : {}),
      ...(options.report ? { emitReport: true } : {}),
    }),
  });

  process.stdout.write(`  done in ${Date.now() - start}ms\n`);
}
