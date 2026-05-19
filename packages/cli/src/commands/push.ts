import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { applyEnvFiles, environmentToCliFlags, resolveConfig } from '@alambic/core';
import { loadConfig } from '../internal/load-config.js';

export interface PushOptions {
  cwd: string;
  configPath?: string;
  envName?: string;
  /** Run `alambic build` before pushing. Default: true. */
  build?: boolean;
}

/**
 * `alambic push [--env <name>]` — push the staged theme at `output/` to
 * the Shopify dev/preprod/prod theme defined by the active environment.
 *
 * Shells out to `shopify theme push --path <output> --store <store> --theme <id>`.
 * If `--build` is true (default), runs `alambic build` first so the
 * staged output reflects the current source.
 */
export async function pushCommand(options: PushOptions): Promise<void> {
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

  if (!resolved.activeEnvironment.store) {
    throw new Error(
      `Cannot push: no \`store\` resolved for environment "${envName ?? '(none)'}". ` +
        `Set SHOPIFY_*_STORE in .env or pass --env <name>.`,
    );
  }
  if (!resolved.activeEnvironment.themeId) {
    throw new Error(
      `Cannot push: no \`themeId\` resolved for environment "${envName ?? '(none)'}". ` +
        `Pushing to the dev theme without a theme id risks creating a new theme on every run.`,
    );
  }

  // Optionally run the build first.
  if (options.build !== false) {
    const { buildCommand } = await import('./build.js');
    await buildCommand({
      cwd: options.cwd,
      ...(options.configPath !== undefined ? { configPath: options.configPath } : {}),
      ...(envName !== null ? { envName } : {}),
    });
  }

  if (!existsSync(resolved.output)) {
    throw new Error(
      `Output directory ${resolved.output} does not exist. Run \`alambic build\` first or pass without --no-build.`,
    );
  }

  const args = ['theme', 'push', '--path', resolved.output];
  // Map the environment flags. For push, --store and --theme are required;
  // --store-password is irrelevant (push uses OAuth).
  for (const flag of environmentToCliFlags(resolved.activeEnvironment)) {
    args.push(flag);
  }

  process.stdout.write(
    `alambic push — environment "${envName ?? '(none)'}" → ${resolved.activeEnvironment.store}\n` +
      `  theme: ${resolved.activeEnvironment.themeId}\n` +
      `  path:  ${resolved.output}\n`,
  );

  await new Promise<void>((resolveExit, reject) => {
    const child = spawn('shopify', args, { stdio: 'inherit', env: process.env });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolveExit();
      else reject(new Error(`shopify theme push exited with code ${code}`));
    });
  });
}
