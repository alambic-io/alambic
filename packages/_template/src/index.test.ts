import { describe, expect, it } from 'vitest';
import { name } from './index.js';

describe('_template', () => {
  it('exports its own name', () => {
    expect(name).toBe('@alambic/_template');
  });
});
