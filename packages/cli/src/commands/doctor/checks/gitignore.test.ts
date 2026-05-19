import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { DoctorContext } from '../types.js';
import { gitignoreCheck } from './gitignore.js';

async function tmp(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'alambic-doctor-gi-'));
}

const ctx = (cwd: string, hasConfig: boolean): DoctorContext => ({ cwd, hasConfig });

describe('gitignoreCheck', () => {
  test('emits nothing when there is no alambic config (e.g. monorepo root)', async () => {
    const cwd = await tmp();
    const out = await gitignoreCheck(ctx(cwd, false));
    expect(out).toEqual([]);
  });

  test('warns when there is no .gitignore', async () => {
    const cwd = await tmp();
    const out = await gitignoreCheck(ctx(cwd, true));
    expect(out).toHaveLength(1);
    expect(out[0]?.severity).toBe('warn');
    expect(out[0]?.message).toMatch(/No \.gitignore/);
  });

  test('warns when .alambic/ is not in .gitignore', async () => {
    const cwd = await tmp();
    await writeFile(join(cwd, '.gitignore'), 'node_modules\ndist\n');
    const out = await gitignoreCheck(ctx(cwd, true));
    expect(out[0]?.severity).toBe('warn');
    expect(out[0]?.message).toMatch(/not in \.gitignore/);
  });

  test('passes when .gitignore contains a bare `.alambic`', async () => {
    const cwd = await tmp();
    await writeFile(join(cwd, '.gitignore'), 'node_modules\n.alambic\n');
    const out = await gitignoreCheck(ctx(cwd, true));
    expect(out[0]?.severity).toBe('pass');
  });

  test('passes when .gitignore contains `.alambic/`', async () => {
    const cwd = await tmp();
    await writeFile(join(cwd, '.gitignore'), '.alambic/\n');
    const out = await gitignoreCheck(ctx(cwd, true));
    expect(out[0]?.severity).toBe('pass');
  });

  test('ignores .alambic mentions inside comment lines', async () => {
    const cwd = await tmp();
    await writeFile(join(cwd, '.gitignore'), '# .alambic\nnode_modules\n');
    const out = await gitignoreCheck(ctx(cwd, true));
    expect(out[0]?.severity).toBe('warn');
  });
});
