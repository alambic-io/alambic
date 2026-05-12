import { describe, expect, it, vi } from 'vitest';
import { run } from './run.js';
import { VERSION } from './version.js';

describe('run', () => {
  it('prints the version with --version', async () => {
    const writes: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      writes.push(typeof chunk === 'string' ? chunk : String(chunk));
      return true;
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('__exit__');
    });

    await expect(run(['node', 'alambic', '--version'])).rejects.toThrow('__exit__');

    writeSpy.mockRestore();
    exitSpy.mockRestore();

    expect(writes.join('')).toContain(VERSION);
  });
});
