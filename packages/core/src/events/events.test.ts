import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from './index.js';

describe('event bus', () => {
  it('delivers payloads to registered handlers', async () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on('build:emit', handler);
    await bus.emit('build:emit', { file: 'a.css' });
    expect(handler).toHaveBeenCalledWith({ file: 'a.css' });
  });

  it('on() returns an unsubscribe function', async () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const off = bus.on('file:changed', handler);
    off();
    await bus.emit('file:changed', { path: 'x.liquid', kind: 'liquid' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('awaits async handlers in order', async () => {
    const bus = createEventBus();
    const calls: number[] = [];
    bus.on('build:done', async (p) => {
      await new Promise((r) => setTimeout(r, 10));
      calls.push(p.durationMs);
    });
    bus.on('build:done', () => {
      calls.push(99);
    });
    await bus.emit('build:done', { outputRoot: '/out', durationMs: 42 });
    expect(calls).toEqual([42, 99]);
  });

  it('handlers removed during emit do not run on subsequent emits', async () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on('dev:ready', handler);
    await bus.emit('dev:ready', { vitePort: 5173, shopifyPort: 9292 });
    bus.off('dev:ready', handler);
    await bus.emit('dev:ready', { vitePort: 5173, shopifyPort: null });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
