/**
 * Tests for `alambic dev`.
 *
 * `devCommand` boots a real Vite server and (optionally) spawns the
 * Shopify CLI, neither of which is friendly to unit testing. We
 * exercise the error/validation paths so missing config or unknown env
 * names fail fast — the rest of the dev loop is exercised by manual
 * usage against the example theme.
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { devCommand } from './dev.js';

describe('devCommand', () => {
  test('rejects unknown environment names', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'alambic-dev-'));
    await mkdir(join(cwd, 'src'), { recursive: true });
    await writeFile(
      join(cwd, 'alambic.config.ts'),
      `export default {
  themeRoot: './src',
  environments: { dev: { store: 'dev.myshopify.com', themeId: '111' } },
};
`,
    );
    await expect(devCommand({ cwd, envName: 'ghost', noShopifyCli: true })).rejects.toThrowError(
      /Unknown environment "ghost"/,
    );
  });

  test('fails fast when alambic.config.ts is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'alambic-dev-noconf-'));
    await expect(devCommand({ cwd, noShopifyCli: true })).rejects.toThrow();
  });
});
