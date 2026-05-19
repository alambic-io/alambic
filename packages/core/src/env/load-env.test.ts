import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyEnvFiles } from './load-env.js';

describe('applyEnvFiles', () => {
  const saved: Record<string, string | undefined> = {};

  function snapshot(key: string) {
    if (!(key in saved)) saved[key] = process.env[key];
  }

  beforeEach(() => {
    for (const k of Object.keys(saved)) delete saved[k];
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('loads .env values into process.env', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'alambic-env-'));
    await writeFile(join(dir, '.env'), 'ALAMBIC_TEST_A=fromdot\n');

    snapshot('ALAMBIC_TEST_A');
    delete process.env['ALAMBIC_TEST_A'];

    const loaded = applyEnvFiles(dir, null);
    expect(loaded['ALAMBIC_TEST_A']).toBe('fromdot');
    expect(process.env['ALAMBIC_TEST_A']).toBe('fromdot');
  });

  it('overlays .env.[name] on top of .env when envName is given', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'alambic-env-'));
    await writeFile(join(dir, '.env'), 'ALAMBIC_TEST_B=base\nALAMBIC_TEST_C=only-in-env\n');
    await writeFile(join(dir, '.env.preprod'), 'ALAMBIC_TEST_B=preprod\n');

    snapshot('ALAMBIC_TEST_B');
    snapshot('ALAMBIC_TEST_C');
    delete process.env['ALAMBIC_TEST_B'];
    delete process.env['ALAMBIC_TEST_C'];

    applyEnvFiles(dir, 'preprod');
    expect(process.env['ALAMBIC_TEST_B']).toBe('preprod');
    expect(process.env['ALAMBIC_TEST_C']).toBe('only-in-env');
  });

  it('respects local overrides (.env.[name].local > .env.[name])', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'alambic-env-'));
    await writeFile(join(dir, '.env.preprod'), 'ALAMBIC_TEST_D=committed\n');
    await writeFile(join(dir, '.env.preprod.local'), 'ALAMBIC_TEST_D=local\n');

    snapshot('ALAMBIC_TEST_D');
    delete process.env['ALAMBIC_TEST_D'];

    applyEnvFiles(dir, 'preprod');
    expect(process.env['ALAMBIC_TEST_D']).toBe('local');
  });

  it('does not overwrite already-set process.env values (shell wins)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'alambic-env-'));
    await writeFile(join(dir, '.env'), 'ALAMBIC_TEST_E=fromfile\n');

    snapshot('ALAMBIC_TEST_E');
    process.env['ALAMBIC_TEST_E'] = 'fromshell';

    applyEnvFiles(dir, null);
    expect(process.env['ALAMBIC_TEST_E']).toBe('fromshell');
  });
});
