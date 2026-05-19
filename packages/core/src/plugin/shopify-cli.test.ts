import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../logger/index.js';
import { spawnShopifyDev } from './shopify-cli.js';

describe('spawnShopifyDev', () => {
  it('spawns the configured binary, exposes a handle, and supports shutdown', async () => {
    const themeRoot = await mkdtemp(join(tmpdir(), 'alambic-cli-'));
    const logger = createLogger('test:shopify-cli');

    // Stand in for `shopify`: a long-running node process.
    const handle = spawnShopifyDev({
      themeRoot,
      port: 9292,
      binary: process.execPath,
      extraArgs: ['-e', 'setInterval(()=>{}, 60_000)'],
      logger,
    });

    expect(handle.running).toBe(true);
    await handle.shutdown(2000);
    expect(handle.running).toBe(false);

    const code = await handle.exited;
    expect(code === null || typeof code === 'number').toBe(true);
  });

  it('surfaces a non-existent binary via the exited promise, not a sync throw', async () => {
    const themeRoot = await mkdtemp(join(tmpdir(), 'alambic-cli-'));
    const logger = createLogger('test:shopify-cli');

    const handle = spawnShopifyDev({
      themeRoot,
      port: 9292,
      binary: `/definitely/not/a/real/binary/${Math.random()}`,
      logger,
    });

    const code = await handle.exited;
    expect(code).toBeNull();
    expect(handle.running).toBe(false);
  });
});
