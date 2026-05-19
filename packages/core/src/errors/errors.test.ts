import { describe, expect, it } from 'vitest';
import { AlambicError, isAlambicError } from './index.js';

describe('AlambicError', () => {
  it('carries code, message, and optional hint/cause', () => {
    const cause = new Error('inner');
    const err = new AlambicError({
      code: 'ALAMBIC_TEST',
      message: 'something went wrong',
      hint: 'see docs',
      cause,
    });

    expect(err.code).toBe('ALAMBIC_TEST');
    expect(err.message).toBe('something went wrong');
    expect(err.hint).toBe('see docs');
    expect(err.cause).toBe(cause);
    expect(err.name).toBe('AlambicError');
  });

  it('isAlambicError narrows correctly', () => {
    const a = new AlambicError({ code: 'ALAMBIC_X', message: 'x' });
    const b = new Error('plain');
    expect(isAlambicError(a)).toBe(true);
    expect(isAlambicError(b)).toBe(false);
    expect(isAlambicError('hello')).toBe(false);
  });

  it('handles missing optional fields', () => {
    const err = new AlambicError({ code: 'ALAMBIC_Y', message: 'y' });
    expect(err.hint).toBeUndefined();
    expect(err.cause).toBeUndefined();
  });
});
