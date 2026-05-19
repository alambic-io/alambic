/**
 * Public contract between a section's `client.ts` and the islands runtime.
 *
 * A section that wants per-island hydration default-exports a `setup`
 * function. The runtime calls it once, when the island enters its load
 * window (eager or on visibility, depending on the `load=` attribute).
 *
 * The contract is intentionally framework-neutral: `setup` gets the
 * island's root element and is free to do anything — start Alpine on
 * the subtree, mount a React tree, attach vanilla event listeners,
 * instantiate a web component, etc.
 */

export type LoadStrategy = 'eager' | 'visible';

export interface IslandSetupContext {
  /** The island's outer DOM element (the `<alambic-island>`). */
  readonly root: HTMLElement;
  /** The section handle from `data-section`. */
  readonly section: string;
  /** The load strategy that fired this setup. */
  readonly strategy: LoadStrategy;
}

/** What a section's `client.ts` default-exports. */
export type IslandSetup =
  | ((ctx: IslandSetupContext) => void | Promise<void>)
  | { default: (ctx: IslandSetupContext) => void | Promise<void> };

/**
 * The manifest the orchestrator injects into the page as inline JSON.
 * Maps section handle → URL of the chunk to import.
 *
 * In dev, the URL is the Vite-served path (`http://localhost:5173/sections/<name>/client.ts`).
 * In build, the URL is the hashed asset path resolved via Shopify's `asset_url`.
 */
export interface IslandManifest {
  readonly entries: Readonly<Record<string, string>>;
}
