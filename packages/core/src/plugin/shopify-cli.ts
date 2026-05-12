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
 * Spawn `shopify theme dev` and stream its stdio to our logger.
 *
 * Phase 1 scope: we don't proxy traffic. The Shopify CLI's preview URL
 * is left as-is and the Vite dev server runs alongside on a separate
 * port. Later phases will introduce HTTP proxying so a single URL
 * serves both.
 */
export function spawnShopifyDev(options: ShopifyCliOptions): ShopifyCliHandle {
  const binary = options.binary ?? 'shopify';
  const args = ['theme', 'dev', '--port', String(options.port), ...(options.extraArgs ?? [])];

  options.logger.info(`Spawning: ${binary} ${args.join(' ')}`);

  let child: ChildProcess;
  try {
    child = spawn(binary, args, {
      cwd: options.themeRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
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

  child.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
    for (const line of chunk.split(/\r?\n/)) {
      if (line.length > 0) options.logger.info(`shopify> ${line}`);
    }
  });
  child.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
    for (const line of chunk.split(/\r?\n/)) {
      if (line.length > 0) options.logger.warn(`shopify! ${line}`);
    }
  });

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
