/**
 * Tests for `alambic push`.
 *
 * `pushCommand` ultimately shells out to `shopify theme push`, so we
 * can't drive happy-path execution from a unit test. What we *can* test
 * is everything before the spawn: config loading, env resolution, and
 * the validation that prevents push without a resolved store/themeId
 * or output dir.
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { pushCommand } from './push.js';

async function makeProject(envs?: { dev?: { store?: string; themeId?: string } }): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'alambic-push-'));
  await mkdir(join(cwd, 'src'), { recursive: true });
  const dev = envs?.dev ?? { store: 'dev.myshopify.com', themeId: '111' };
  const parts: string[] = [];
  if (dev.store !== undefined) parts.push(`store: ${JSON.stringify(dev.store)}`);
  if (dev.themeId !== undefined) parts.push(`themeId: ${JSON.stringify(dev.themeId)}`);
  await writeFile(
    join(cwd, 'alambic.config.ts'),
    `export default {
  themeRoot: './src',
  environments: { dev: { ${parts.join(', ')} } },
  defaultEnvironment: 'dev',
};
`,
  );
  return cwd;
}

describe('pushCommand', () => {
  let cwd: string;
  beforeEach(async () => {
    cwd = await makeProject();
  });

  test('throws when no store is resolved for the active env', async () => {
    cwd = await makeProject({ dev: { themeId: '111' } });
    await expect(pushCommand({ cwd, envName: 'dev', build: false })).rejects.toThrowError(
      /no `store` resolved/,
    );
  });

  test('throws when no themeId is resolved for the active env', async () => {
    cwd = await makeProject({ dev: { store: 'dev.myshopify.com' } });
    await expect(pushCommand({ cwd, envName: 'dev', build: false })).rejects.toThrowError(
      /no `themeId` resolved/,
    );
  });

  test('throws when --no-build is used and the output dir does not exist', async () => {
    // Configured envs are fine; output dir is missing.
    await expect(pushCommand({ cwd, envName: 'dev', build: false })).rejects.toThrowError(
      /Output directory .* does not exist/,
    );
  });

  test('throws on unknown environment names', async () => {
    await expect(pushCommand({ cwd, envName: 'ghost', build: false })).rejects.toThrowError(
      /Unknown environment "ghost"/,
    );
  });
});
