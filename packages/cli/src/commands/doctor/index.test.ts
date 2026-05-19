import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { doctor } from './index.js';

// The Versions check shells out to `shopify version`, which can take
// several seconds on a cold shopify-cli install. 5s is too tight in CI.
const TIMEOUT_MS = 30_000;

describe('doctor', () => {
  it(
    'runs in a directory with no alambic.config.ts and reports versions only',
    async () => {
      const cwd = await mkdtemp(join(tmpdir(), 'alambic-doctor-'));
      const result = await doctor(cwd);
      // Versions check always runs. Config/theme/env checks return [] when
      // there's no config in the cwd.
      expect(result.results.some((r) => r.group === 'Versions')).toBe(true);
      expect(result.results.find((r) => r.name === 'Node')?.severity).toBe('pass');
    },
    TIMEOUT_MS,
  );

  it(
    'produces non-empty human-readable output with a header and footer',
    async () => {
      const cwd = await mkdtemp(join(tmpdir(), 'alambic-doctor-'));
      const result = await doctor(cwd);
      expect(result.lines.length).toBeGreaterThan(2);
      expect(result.lines[0]).toMatch(/alambic doctor/);
      expect(result.lines.at(-1)).toMatch(/warning(s)?, \d+ error(s)?/);
    },
    TIMEOUT_MS,
  );

  it(
    'reports an empty cwd as warning on Config, not fail',
    async () => {
      const cwd = await mkdtemp(join(tmpdir(), 'alambic-doctor-'));
      const result = await doctor(cwd);
      const configResult = result.results.find((r) => r.group === 'Config');
      expect(configResult?.severity).toBe('warn');
    },
    TIMEOUT_MS,
  );
});
