import { loadEnv as viteLoadEnv } from 'vite';

/**
 * Mirror Vite's env-file precedence and merge them into `process.env`.
 * Returns the merged variables so callers can also inspect them.
 *
 * File precedence (lowest → highest priority):
 *   - `.env`
 *   - `.env.local`
 *   - `.env.[envName]`     (only if envName provided)
 *   - `.env.[envName].local` (only if envName provided)
 *
 * Existing `process.env` values are NEVER overwritten — explicit shell
 * env (e.g. `SHOPIFY_DEV_STORE=... pnpm dev`) wins over files.
 */
export function applyEnvFiles(cwd: string, envName: string | null): Record<string, string> {
  // Vite uses 'development' / 'production' as default mode names, and reads:
  //   .env, .env.local, .env.[mode], .env.[mode].local
  //
  // We always read .env / .env.local. If envName is null, pass a sentinel
  // that won't match any `.env.<name>` file — Vite still loads .env+.env.local.
  const mode = envName ?? '__alambic_no_env__';
  const loaded = viteLoadEnv(mode, cwd, '');
  for (const [k, v] of Object.entries(loaded)) {
    if (!(k in process.env) || process.env[k] === '') {
      process.env[k] = v;
    }
  }
  return loaded;
}
