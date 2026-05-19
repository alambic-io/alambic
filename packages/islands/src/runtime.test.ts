// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { IslandManifest } from './types.js';

declare global {
  interface Window {
    __alambic?: { manifest?: IslandManifest };
  }
}

interface MockObserverInstance {
  trigger: (isIntersecting: boolean) => void;
  disconnect: () => void;
  target: Element | null;
}

const observers: MockObserverInstance[] = [];

class MockIntersectionObserver {
  private callback: IntersectionObserverCallback;
  private instance: MockObserverInstance;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    this.instance = {
      target: null,
      trigger: (isIntersecting: boolean) => {
        if (!this.instance.target) return;
        const entry = {
          isIntersecting,
          target: this.instance.target,
        } as IntersectionObserverEntry;
        this.callback([entry], this as unknown as IntersectionObserver);
      },
      disconnect: () => {
        this.instance.target = null;
      },
    };
    observers.push(this.instance);
  }

  observe(target: Element): void {
    this.instance.target = target;
  }

  unobserve(): void {
    this.instance.target = null;
  }

  disconnect(): void {
    this.instance.disconnect();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

beforeEach(() => {
  observers.length = 0;
  // biome-ignore lint/suspicious/noExplicitAny: test shim
  (globalThis as any).IntersectionObserver = MockIntersectionObserver;
  // biome-ignore lint/suspicious/noExplicitAny: test shim
  (window as any).IntersectionObserver = MockIntersectionObserver;
  window.__alambic = { manifest: { entries: {} } };
  document.body.innerHTML = '';
});

afterEach(() => {
  delete window.__alambic;
});

// Vitest reloads modules per import; we import after env is set up
async function importRuntime() {
  vi.resetModules();
  return await import('./runtime.js');
}

describe('AlambicIsland custom element', () => {
  test('registers the <alambic-island> custom element idempotently', async () => {
    const { registerAlambicIsland } = await importRuntime();
    expect(customElements.get('alambic-island')).toBeDefined();
    // calling again must not throw
    expect(() => registerAlambicIsland()).not.toThrow();
  });

  test('warns and skips when data-section is missing', async () => {
    await importRuntime();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML = '<alambic-island></alambic-island>';
    await flush();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('missing data-section'),
      expect.anything(),
    );
    warn.mockRestore();
  });

  test('warns when no manifest entry exists for the section', async () => {
    await importRuntime();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML =
      '<alambic-island data-section="ghost" data-load="eager"></alambic-island>';
    await flush();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('no manifest entry for section "ghost"'),
    );
    warn.mockRestore();
  });

  test('lazy strategy installs an IntersectionObserver and does not hydrate before visibility', async () => {
    await importRuntime();
    document.body.innerHTML =
      '<alambic-island data-section="hero" data-load="visible"></alambic-island>';
    await flush();
    expect(observers).toHaveLength(1);
    expect(observers[0]?.target).not.toBeNull();
  });

  test('eager strategy does not install an observer', async () => {
    window.__alambic = { manifest: { entries: { hero: 'data:text/javascript;base64,' } } };
    await importRuntime();
    document.body.innerHTML =
      '<alambic-island data-section="hero" data-load="eager"></alambic-island>';
    await flush();
    expect(observers).toHaveLength(0);
  });

  test('disconnecting before visibility tears down the observer', async () => {
    await importRuntime();
    document.body.innerHTML =
      '<alambic-island data-section="hero" data-load="visible"></alambic-island>';
    await flush();
    expect(observers[0]?.target).not.toBeNull();
    document.body.innerHTML = '';
    await flush();
    expect(observers[0]?.target).toBeNull();
  });

  test('defaults to eager when data-load is omitted', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await importRuntime();
    document.body.innerHTML = '<alambic-island data-section="ghost"></alambic-island>';
    await flush();
    // Hits the eager path → manifest miss → exactly one warn, no observer
    expect(observers).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no manifest entry'));
    warn.mockRestore();
  });
});

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
