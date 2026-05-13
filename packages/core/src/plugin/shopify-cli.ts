import { type ChildProcess, spawn } from 'node:child_process';
import { AlambicError } from '../errors/index.js';
import type { Logger } from '../logger/index.js';

export interface ShopifyCliOptions {
  themeRoot: string;
  /** Port for `shopify theme dev`. */
  port: number;
  /** Extra args passed through to the CLI. */
  extraArgs?: ReadonlyArray<string>;
  /** Override the binary name. Defaults to `shopify`. */
  binary?: string;
  logger: Logger;
}

export interface ShopifyCliHandle {
  /** Resolves once the underlying child process exits. */
  exited: Promise<number | null>;
  /** Send SIGTERM, then SIGKILL after `graceMs`. */
  shutdown(graceMs?: number): Promise<void>;
  /** True while the process is alive. */
  readonly running: boolean;
}

/**
 * Spawn `shopify theme dev` with stdio inherited from the parent.
 *
 * stdio is inherited (not piped) for two reasons:
 *   1. The CLI's output uses ANSI box-drawing characters that get
 *      mangled by line-by-line re-logging.
 *   2. The CLI accepts interactive keystrokes (`t`/`p`/`e`/`g`) to
 *      open preview URLs — those only work if stdin is connected.
 *
 * Phase 1 scope: no HTTP proxying. The Shopify CLI's preview URL is
 * left as-is and Vite runs alongside on a separate port. Later phases
 * will introduce proxying so a single URL serves both.
 */
export function spawnShopifyDev(options: ShopifyCliOptions): ShopifyCliHandle {
  const binary = options.binary ?? 'shopify';
  const args = ['theme', 'dev', '--port', String(options.port), ...(options.extraArgs ?? [])];

  options.logger.info(`Spawning: ${binary} ${args.join(' ')}`);

  let child: ChildProcess;
  try {
    child = spawn(binary, args, {
      cwd: options.themeRoot,
      stdio: 'inherit',
      env: process.env,
    });
  } catch (cause) {
    throw new AlambicError({
      code: 'ALAMBIC_SHOPIFY_CLI_SPAWN_FAILED',
      message: `Failed to spawn '${binary} theme dev'`,
      hint: 'Is the Shopify CLI installed and on $PATH? (npm i -g @shopify/cli)',
      cause,
    });
  }

  let running = true;

  const exited = new Promise<number | null>((resolve) => {
    child.once('exit', (code) => {
      running = false;
      options.logger.info(`shopify theme dev exited with code ${code ?? '<null>'}`);
      resolve(code);
    });
    child.once('error', (err) => {
      running = false;
      options.logger.error(err);
      resolve(null);
    });
  });

  async function shutdown(graceMs = 5000): Promise<void> {
    if (!running) return;
    child.kill('SIGTERM');
    const timer = setTimeout(() => {
      if (running) {
        options.logger.warn(`shopify theme dev did not exit within ${graceMs}ms, sending SIGKILL`);
        child.kill('SIGKILL');
      }
    }, graceMs);
    await exited;
    clearTimeout(timer);
  }

  return {
    exited,
    shutdown,
    get running() {
      return running;
    },
  };
}
