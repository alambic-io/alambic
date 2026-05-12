import { describe, expect, it } from 'vitest';
import { substitute } from './substitute.js';

describe('substitute', () => {
  it('replaces known tokens', () => {
    expect(substitute('Hello, {{NAME}}!', { NAME: 'world' })).toBe('Hello, world!');
  });

  it('passes through unknown tokens', () => {
    expect(substitute('{{UNKNOWN}} stays', { NAME: 'x' })).toBe('{{UNKNOWN}} stays');
  });

  it('replaces multiple distinct tokens', () => {
    expect(substitute('{{A}} + {{B}} = {{C}}', { A: '1', B: '2', C: '3' })).toBe('1 + 2 = 3');
  });

  it('does not treat lowercase tokens', () => {
    expect(substitute('{{lower}}', { lower: 'x' })).toBe('{{lower}}');
  });
});
