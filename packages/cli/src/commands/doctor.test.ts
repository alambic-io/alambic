import { describe, expect, it } from 'vitest';
import { doctor } from './doctor.js';

describe('doctor', () => {
  it('returns ok=true on a healthy workspace', async () => {
    const result = await doctor();
    expect(result.ok).toBe(true);
    expect(result.errors).toBe(0);
  });

  it('produces non-empty human-readable output', async () => {
    const result = await doctor();
    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.lines[0]).toMatch(/alambic doctor/);
  });
});
