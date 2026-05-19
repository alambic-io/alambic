/**
 * `ALAMBIC_THEME_ROOT` is the env-var bridge for the CLI's
 * `--theme-root <path>` global flag. Flag > config > default.
 */
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { resolveConfig } from './index.js';

describe('themeRoot override via ALAMBIC_THEME_ROOT', () => {
  const previous = process.env['ALAMBIC_THEME_ROOT'];

  beforeEach(() => {
    delete process.env['ALAMBIC_THEME_ROOT'];
  });

  afterEach(() => {
    if (previous === undefined) delete process.env['ALAMBIC_THEME_ROOT'];
    else process.env['ALAMBIC_THEME_ROOT'] = previous;
  });

  test('uses the default ./src when no override and no config value', () => {
    const out = resolveConfig({}, '/proj');
    expect(out.themeRoot).toBe('/proj/src');
  });

  test('uses the config value when no override is set', () => {
    const out = resolveConfig({ themeRoot: './app' }, '/proj');
    expect(out.themeRoot).toBe('/proj/app');
  });

  test('env override wins over the config value', () => {
    process.env['ALAMBIC_THEME_ROOT'] = './from-cli';
    const out = resolveConfig({ themeRoot: './from-config' }, '/proj');
    expect(out.themeRoot).toBe('/proj/from-cli');
  });

  test('env override is resolved against cwd, supporting absolute paths', () => {
    process.env['ALAMBIC_THEME_ROOT'] = '/absolute/src';
    const out = resolveConfig({}, '/proj');
    expect(out.themeRoot).toBe('/absolute/src');
  });
});
