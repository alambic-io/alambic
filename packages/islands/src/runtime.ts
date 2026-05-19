/**
 * Browser-side runtime for `<alambic-island>` custom elements.
 *
 * Usage in Liquid:
 *
 *   <alambic-island data-section="hero" data-load="visible">
 *     <section data-section-id="{{ section.id }}">
 *       ...
 *     </section>
 *   </alambic-island>
 *
 * On `connectedCallback`, the element:
 *   1. Reads `data-section` and `data-load` (default: `eager`).
 *   2. Looks up the section's JS chunk URL in `window.__alambic.manifest`.
 *   3. For `load="eager"`: imports + invokes immediately.
 *      For `load="visible"`: defers to an IntersectionObserver firing
 *      with rootMargin "200px" before the element enters the viewport.
 *
 * The chunk's default export is treated as `setup(ctx)` — called once,
 * with the island root and section handle. Framework-neutral: what
 * `setup` does is up to the section.
 */
import type { IslandManifest, IslandSetup, IslandSetupContext, LoadStrategy } from './types.js';

declare global {
  interface Window {
    __alambic?: { manifest?: IslandManifest };
  }
}

const ALREADY_LOADED = new WeakSet<HTMLElement>();

class AlambicIsland extends HTMLElement {
  private observer: IntersectionObserver | null = null;

  connectedCallback(): void {
    if (ALREADY_LOADED.has(this)) return;
    const section = this.dataset['section'];
    const strategy = (this.dataset['load'] ?? 'eager') as LoadStrategy;
    if (!section) {
      console.warn('[alambic-island] missing data-section attribute', this);
      return;
    }

    if (strategy === 'visible') {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              this.disconnectObserver();
              void this.hydrate(section, strategy);
              break;
            }
          }
        },
        { rootMargin: '200px' },
      );
      this.observer.observe(this);
    } else {
      void this.hydrate(section, strategy);
    }
  }

  disconnectedCallback(): void {
    this.disconnectObserver();
  }

  private disconnectObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private async hydrate(section: string, strategy: LoadStrategy): Promise<void> {
    if (ALREADY_LOADED.has(this)) return;
    ALREADY_LOADED.add(this);

    const manifest = window.__alambic?.manifest;
    const url = manifest?.entries?.[section];
    if (!url) {
      console.warn(`[alambic-island] no manifest entry for section "${section}"`);
      return;
    }

    let mod: unknown;
    try {
      mod = await import(/* @vite-ignore */ url);
    } catch (err) {
      console.warn(`[alambic-island] failed to import ${url}:`, err);
      return;
    }

    const setup = resolveSetup(mod);
    if (!setup) {
      console.warn(`[alambic-island] chunk ${url} has no default export`);
      return;
    }

    const ctx: IslandSetupContext = { root: this, section, strategy };
    try {
      await setup(ctx);
    } catch (err) {
      console.warn(`[alambic-island] setup() threw for section "${section}":`, err);
    }
  }
}

function resolveSetup(mod: unknown): ((ctx: IslandSetupContext) => unknown) | null {
  if (typeof mod === 'function') return mod as (ctx: IslandSetupContext) => unknown;
  if (typeof mod === 'object' && mod !== null) {
    const def = (mod as { default?: unknown }).default;
    if (typeof def === 'function') return def as (ctx: IslandSetupContext) => unknown;
  }
  return null;
}

/**
 * Idempotently register the custom element. Safe to call multiple times
 * (e.g. if the runtime script is loaded more than once via duplicate
 * `<script>` tags — a quirk of Liquid layouts).
 */
export function registerAlambicIsland(): void {
  if (typeof customElements === 'undefined') return;
  if (customElements.get('alambic-island')) return;
  customElements.define('alambic-island', AlambicIsland);
}

// Auto-register when this module is loaded as a side-effect script.
registerAlambicIsland();

// Re-export for tests + advanced consumers.
export { AlambicIsland };
export type { IslandManifest, IslandSetup, IslandSetupContext, LoadStrategy };
