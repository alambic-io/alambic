import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyEnvFiles,
  environmentToCliFlags,
  resolveConfig,
  type ResolvedEnvironment,
} from '@alambic/core';
import { loadConfig } from '../internal/load-config.js';

/**
 * `alambic pull [--env <name>] [--into <name>]` — pull merchant-owned
 * JSON files from one Shopify theme into either the local `themeRoot`
 * or another environment's remote theme.
 *
 * Merchant-owned files (templates/*.json, config/settings_data.json,
 * sections/*.json) are routinely edited via the Shopify theme editor.
 * `alambic pull --env prod` fetches the merchant's current state.
 * `--into dev` then pushes that state straight to a target env, so
 * dev/preprod mirrors prod without touching the local working copy.
 *
 * Implementation: shells out to `shopify theme pull` and (when
 * --into is given) `shopify theme push`, scoped via `--only` patterns.
 * No bidirectional reconciliation — that's a Shopify-level problem.
 */
export interface PullOptions {
  cwd: string;
  configPath?: string;
  /** Source env (where files come from). Defaults to defaultEnvironment. */
  envName?: string;
  /**
   * Target env (where files go). If omitted, pulled files land in
   * themeRoot (the local source dir). If set, pull → push to this env,
   * leaving src/ untouched.
   */
  intoEnvName?: string;
  /**
   * Comma-separated `--only` patterns. Defaults to the merchant-owned
   * set (templates/*.json, config/settings_data.json, sections/*.json).
   */
  only?: string;
  /** Print the commands without executing them. */
  dryRun?: boolean;
}

export const DEFAULT_PULL_PATTERNS: ReadonlyArray<string> = [
  'templates/*.json',
  'config/settings_data.json',
  'sections/*.json',
];

export async function pullCommand(options: PullOptions): Promise<void> {
  applyEnvFiles(options.cwd, null);

  const { config, cwd } = await loadConfig(options.cwd, options.configPath);

  const srcEnvName = options.envName ?? config.defaultEnvironment ?? null;
  if (srcEnvName) applyEnvFiles(cwd, srcEnvName);

  const srcResolved = resolveConfig(
    {
      ...config,
      ...(srcEnvName !== null ? { activeEnvironmentName: srcEnvName } : {}),
    },
    cwd,
  );

  assertEnv('Cannot pull', srcEnvName, srcResolved.activeEnvironment);

  const patterns = options.only
    ? options.only
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [...DEFAULT_PULL_PATTERNS];
  const onlyArgs = patterns.flatMap((p) => ['--only', p]);

  // Target-env case: temp dir + pull + push. The temp dir is the
  // Shopify-shaped tree (flat sections, flat templates), which is fine
  // because we only deal with flat JSON files.
  if (options.intoEnvName) {
    if (options.intoEnvName === srcEnvName) {
      throw new Error(
        `--into ${options.intoEnvName} matches --env: source and target must differ.`,
      );
    }
    // Resolve the target env. We re-apply env files for it so any
    // SHOPIFY_<TARGET>_* overrides land in process.env.
    applyEnvFiles(cwd, options.intoEnvName);
    const tgtResolved = resolveConfig(
      { ...config, activeEnvironmentName: options.intoEnvName },
      cwd,
    );
    assertEnv('Cannot push to target', options.intoEnvName, tgtResolved.activeEnvironment);

    const temp = await mkdtemp(join(tmpdir(), 'alambic-pull-'));
    try {
      const pullArgs = [
        'theme',
        'pull',
        '--path',
        temp,
        '--nodelete',
        ...onlyArgs,
        ...environmentToCliFlags(srcResolved.activeEnvironment),
      ];
      const pushArgs = [
        'theme',
        'push',
        '--path',
        temp,
        '--nodelete',
        ...onlyArgs,
        ...environmentToCliFlags(tgtResolved.activeEnvironment),
      ];

      process.stdout.write(
        `alambic pull — ${srcEnvName} (${srcResolved.activeEnvironment.store}) → ` +
          `${options.intoEnvName} (${tgtResolved.activeEnvironment.store})\n` +
          `  patterns: ${patterns.join(', ')}\n` +
          `  temp:     ${temp}\n`,
      );

      if (options.dryRun) {
        process.stdout.write(`  [dry-run] shopify ${pullArgs.join(' ')}\n`);
        process.stdout.write(`  [dry-run] shopify ${pushArgs.join(' ')}\n`);
        return;
      }

      await runShopify(pullArgs);
      await runShopify(pushArgs);
    } finally {
      // Best-effort cleanup. Don't mask the original error if rm fails.
      await rm(temp, { recursive: true, force: true }).catch(() => undefined);
    }
    return;
  }

  // No target env: pull directly into themeRoot (the local source dir).
  // Safe because the pattern set only matches files that are flat in
  // both the Shopify-shaped tree and our `src/` layout.
  const pullArgs = [
    'theme',
    'pull',
    '--path',
    srcResolved.themeRoot,
    '--nodelete',
    ...onlyArgs,
    ...environmentToCliFlags(srcResolved.activeEnvironment),
  ];

  process.stdout.write(
    `alambic pull — ${srcEnvName} (${srcResolved.activeEnvironment.store}) → ${srcResolved.themeRoot}\n` +
      `  patterns: ${patterns.join(', ')}\n`,
  );

  if (options.dryRun) {
    process.stdout.write(`  [dry-run] shopify ${pullArgs.join(' ')}\n`);
    return;
  }

  await runShopify(pullArgs);
}

function assertEnv(label: string, name: string | null, env: ResolvedEnvironment): void {
  if (!env.store) {
    throw new Error(
      `${label}: no \`store\` resolved for environment "${name ?? '(none)'}". ` +
        `Set SHOPIFY_*_STORE in .env or pass --env <name>.`,
    );
  }
  if (!env.themeId) {
    throw new Error(
      `${label}: no \`themeId\` resolved for environment "${name ?? '(none)'}". ` +
        `Pull/push without a theme id is ambiguous.`,
    );
  }
}

function runShopify(args: ReadonlyArray<string>): Promise<void> {
  return new Promise((resolveExit, reject) => {
    const child = spawn('shopify', args as string[], { stdio: 'inherit', env: process.env });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolveExit();
      else reject(new Error(`shopify ${args[0]} ${args[1]} exited with code ${code}`));
    });
  });
}
