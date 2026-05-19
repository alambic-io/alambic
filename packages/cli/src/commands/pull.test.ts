import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DEFAULT_PULL_PATTERNS, pullCommand } from './pull.js';

/**
 * Create a temp project with an alambic.config.ts whose env values are
 * literal strings (not `env()` refs) — we avoid importing from
 * `@alambic/core` because the temp dir has no node_modules and jiti
 * would fail to resolve workspace packages. The shapes are otherwise
 * equivalent to a normal consumer config.
 */
async function makeProject(envs?: {
  dev?: { store?: string; themeId?: string };
  prod?: { store?: string; themeId?: string };
}): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'alambic-pull-'));
  await mkdir(join(cwd, 'src'), { recursive: true });
  const dev = envs?.dev ?? { store: 'dev.myshopify.com', themeId: '111' };
  const prod = envs?.prod ?? { store: 'prod.myshopify.com', themeId: '222' };
  const envBlock = (e: { store?: string; themeId?: string }): string => {
    const parts: string[] = [];
    if (e.store !== undefined) parts.push(`store: ${JSON.stringify(e.store)}`);
    if (e.themeId !== undefined) parts.push(`themeId: ${JSON.stringify(e.themeId)}`);
    return `{ ${parts.join(', ')} }`;
  };
  await writeFile(
    join(cwd, 'alambic.config.ts'),
    `export default {
  themeRoot: './src',
  environments: {
    dev:  ${envBlock(dev)},
    prod: ${envBlock(prod)},
  },
  defaultEnvironment: 'dev',
};
`,
  );
  return cwd;
}

describe('pullCommand', () => {
  let stdout: string[];
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdout = [];
    writeSpy = vi
      .spyOn(process.stdout, 'write')
      // biome-ignore lint/suspicious/noExplicitAny: stdout.write has a multi-overload signature
      .mockImplementation(((chunk: string | Uint8Array) => {
        stdout.push(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
      }) as any);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  test('exports a default pattern set covering merchant-owned JSON', () => {
    expect(DEFAULT_PULL_PATTERNS).toEqual([
      'templates/*.json',
      'config/settings_data.json',
      'sections/*.json',
    ]);
  });

  test('throws when the source env has no resolved store', async () => {
    const cwd = await makeProject({ dev: {} });
    await expect(pullCommand({ cwd, envName: 'dev', dryRun: true })).rejects.toThrowError(
      /no `store` resolved/,
    );
  });

  test('throws when --env and --into name the same environment', async () => {
    const cwd = await makeProject();
    await expect(
      pullCommand({ cwd, envName: 'dev', intoEnvName: 'dev', dryRun: true }),
    ).rejects.toThrowError(/source and target must differ/);
  });

  test('dry-run with no --into prints a single pull plan into themeRoot', async () => {
    const cwd = await makeProject();
    await pullCommand({ cwd, envName: 'prod', dryRun: true });
    const all = stdout.join('');
    expect(all).toContain('alambic pull — prod (prod.myshopify.com)');
    expect(all).toContain('[dry-run] shopify theme pull');
    expect(all).toContain('--store prod.myshopify.com');
    expect(all).toContain('--theme 222');
    expect(all).toContain('--only templates/*.json');
    expect(all).not.toContain('shopify theme push');
  });

  test('dry-run with --into prints both pull and push plans', async () => {
    const cwd = await makeProject();
    await pullCommand({
      cwd,
      envName: 'prod',
      intoEnvName: 'dev',
      dryRun: true,
    });
    const all = stdout.join('');
    expect(all).toContain('[dry-run] shopify theme pull');
    expect(all).toContain('[dry-run] shopify theme push');
    expect(all).toContain('--store prod.myshopify.com');
    expect(all).toContain('--store dev.myshopify.com');
  });

  test('--only overrides the default patterns', async () => {
    const cwd = await makeProject();
    await pullCommand({
      cwd,
      envName: 'prod',
      only: 'templates/index.json, config/settings_data.json',
      dryRun: true,
    });
    const all = stdout.join('');
    expect(all).toContain('--only templates/index.json');
    expect(all).toContain('--only config/settings_data.json');
    expect(all).not.toContain('--only sections/*.json');
  });
});
