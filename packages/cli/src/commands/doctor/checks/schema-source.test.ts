import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { DoctorContext } from '../types.js';
import { schemaSourceCheck } from './schema-source.js';

async function makeProject(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'alambic-doctor-ss-'));
  await writeFile(join(cwd, 'alambic.config.ts'), `export default { themeRoot: './src' };\n`);
  await mkdir(join(cwd, 'src'), { recursive: true });
  return cwd;
}

async function makeSection(
  cwd: string,
  name: string,
  files: { schemaTs?: boolean; inlineSchema?: boolean; kind?: 'sections' | 'blocks' },
): Promise<void> {
  const kind = files.kind ?? 'sections';
  const folder = join(cwd, 'src', kind, name);
  await mkdir(folder, { recursive: true });
  const inline = files.inlineSchema ? `{% schema %}\n{ "name": "${name}" }\n{% endschema %}\n` : '';
  await writeFile(join(folder, 'index.liquid'), `<section>${name}</section>\n${inline}`);
  if (files.schemaTs) {
    await writeFile(
      join(folder, 'schema.ts'),
      `import { section } from '@alambic/schema';\nexport default section({ name: '${name}', settings: [] });\n`,
    );
  }
}

const ctx = (cwd: string, hasConfig: boolean): DoctorContext => ({ cwd, hasConfig });

describe('schemaSourceCheck', () => {
  test('emits nothing when there is no config (monorepo root case)', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'alambic-no-config-'));
    const out = await schemaSourceCheck(ctx(cwd, false));
    expect(out).toEqual([]);
  });

  test('passes when every section has schema.ts only', async () => {
    const cwd = await makeProject();
    await makeSection(cwd, 'hero', { schemaTs: true });
    await makeSection(cwd, 'featured', { schemaTs: true });
    const out = await schemaSourceCheck(ctx(cwd, true));
    expect(out[0]?.severity).toBe('pass');
  });

  test('passes when sections only have inline {% schema %} (no schema.ts)', async () => {
    const cwd = await makeProject();
    await makeSection(cwd, 'hero', { inlineSchema: true });
    const out = await schemaSourceCheck(ctx(cwd, true));
    expect(out[0]?.severity).toBe('pass');
  });

  test('warns when a section has both schema.ts AND inline {% schema %}', async () => {
    const cwd = await makeProject();
    await makeSection(cwd, 'hero', { schemaTs: true, inlineSchema: true });
    const out = await schemaSourceCheck(ctx(cwd, true));
    expect(out[0]?.severity).toBe('warn');
    expect(out[0]?.message).toContain('sections/hero');
  });

  test('detects conflicts in theme blocks too', async () => {
    const cwd = await makeProject();
    await makeSection(cwd, 'badge', { schemaTs: true, inlineSchema: true, kind: 'blocks' });
    const out = await schemaSourceCheck(ctx(cwd, true));
    expect(out[0]?.severity).toBe('warn');
    expect(out[0]?.message).toContain('blocks/badge');
  });

  test('lists multiple conflicts in one message', async () => {
    const cwd = await makeProject();
    await makeSection(cwd, 'hero', { schemaTs: true, inlineSchema: true });
    await makeSection(cwd, 'featured', { schemaTs: true, inlineSchema: true });
    const out = await schemaSourceCheck(ctx(cwd, true));
    expect(out[0]?.message).toContain('sections/hero');
    expect(out[0]?.message).toContain('sections/featured');
  });
});
