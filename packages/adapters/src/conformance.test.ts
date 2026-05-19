/**
 * The conformance suite must pass against its own no-op adapters.
 * If this test fails, the suite is broken (not the adapter).
 *
 * Real-adapter coverage lives in `@alambic/preset-tailwind-alpine`'s tests.
 */
import { describe, expect, test } from 'vitest';
import {
  cssAdapterCases,
  jsAdapterCases,
  makeStubContext,
  noopCssAdapter,
  noopJsAdapter,
} from './conformance.js';

describe('conformance suite self-test (CSS)', () => {
  const ctx = makeStubContext();
  for (const c of cssAdapterCases) {
    test(c.name, async () => {
      await c.run(noopCssAdapter, ctx);
    });
  }

  test('detects a CssAdapter missing `name`', () => {
    const bad = { ...noopCssAdapter, name: '' };
    const nameCase = cssAdapterCases.find((c) => c.name.includes('`name`'));
    expect(() => nameCase?.run(bad, ctx)).toThrow();
  });

  test('detects non-deterministic emitTokens', () => {
    let i = 0;
    const flaky = {
      ...noopCssAdapter,
      emitTokens: () => `output-${i++}`,
    };
    const determinismCase = cssAdapterCases.find((c) => c.name.includes('deterministic'));
    expect(() => determinismCase?.run(flaky, ctx)).toThrow(/non-deterministic/);
  });
});

describe('conformance suite self-test (JS)', () => {
  const ctx = makeStubContext();
  for (const c of jsAdapterCases) {
    test(c.name, async () => {
      await c.run(noopJsAdapter, ctx);
    });
  }

  test('detects a JsAdapter missing hydrationRuntime', () => {
    const bad = { ...noopJsAdapter, hydrationRuntime: '' };
    const c = jsAdapterCases.find((c) => c.name.includes('hydrationRuntime'));
    expect(() => c?.run(bad, ctx)).toThrow();
  });

  test('detects discoverEntries returning malformed entries', () => {
    const bad = {
      ...noopJsAdapter,
      discoverEntries: () => [{ id: 42, file: 'x.ts' } as unknown as { id: string; file: string }],
    };
    const c = jsAdapterCases.find((c) => c.name.includes('discoverEntries'));
    expect(() => c?.run(bad, ctx)).toThrow();
  });
});
