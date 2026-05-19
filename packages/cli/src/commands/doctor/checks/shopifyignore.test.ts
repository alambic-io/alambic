import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { DoctorContext } from '../types.js';
import { shopifyignoreCheck } from './shopifyignore.js';

async function makeProject(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'alambic-doctor-si-'));
  await writeFile(join(cwd, 'alambic.config.ts'), `export default { themeRoot: './src' };\n`);
  await mkdir(join(cwd, 'src'), { recursive: true });
  return cwd;
}

const ctx = (cwd: string, hasConfig: boolean): DoctorContext => ({ cwd, hasConfig });

describe('shopifyignoreCheck', () => {
  test('emits nothing when there is no config (monorepo root)', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'alambic-noconf-'));
    const out = await shopifyignoreCheck(ctx(cwd, false));
    expect(out).toEqual([]);
  });

  test('passes silently for a brand-new project (no templates/*.json yet)', async () => {
    const cwd = await makeProject();
    const out = await shopifyignoreCheck(ctx(cwd, true));
    expect(out[0]?.severity).toBe('pass');
    expect(out[0]?.message).toMatch(/Not needed yet/);
  });

  test('warns when templates/*.json exist but no .shopifyignore is set', async () => {
    const cwd = await makeProject();
    await mkdir(join(cwd, 'src', 'templates'), { recursive: true });
    await writeFile(join(cwd, 'src', 'templates', 'index.json'), '{}');
    const out = await shopifyignoreCheck(ctx(cwd, true));
    expect(out[0]?.severity).toBe('warn');
    expect(out[0]?.message).toMatch(/No \.shopifyignore/);
  });

  test('passes when .shopifyignore exists in themeRoot', async () => {
    const cwd = await makeProject();
    await mkdir(join(cwd, 'src', 'templates'), { recursive: true });
    await writeFile(join(cwd, 'src', 'templates', 'index.json'), '{}');
    await writeFile(join(cwd, 'src', '.shopifyignore'), 'templates/*.json\n');
    const out = await shopifyignoreCheck(ctx(cwd, true));
    expect(out[0]?.severity).toBe('pass');
    expect(out[0]?.message).toMatch(/Found/);
  });
});
