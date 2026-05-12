import { describe, expect, it } from 'vitest';
import { createLogger } from './index.js';

describe('createLogger', () => {
  it('returns a logger with the requested namespace', () => {
    const log = createLogger('test');
    expect(log.namespace).toBe('test');
    expect(typeof log.error).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.info).toBe('function');
    expect(typeof log.debug).toBe('function');
  });

  it('extends namespace via withTag', () => {
    const log = createLogger('parent').withTag('child');
    expect(log.namespace).toBe('parent:child');
  });
});
