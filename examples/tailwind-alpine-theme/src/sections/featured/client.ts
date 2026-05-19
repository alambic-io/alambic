import type { IslandSetupContext } from '@alambic/islands';

/**
 * Per-section JS for the `featured` section. Bundled as a separate Vite
 * entry; the islands runtime imports this module only when the section
 * scrolls into view (configured via `data-load="visible"`).
 *
 * The runtime calls `setup(ctx)` once with the island's root element.
 * What we do with it is up to us — framework-neutral. Here we wire
 * vanilla DOM event handlers; the same slot could mount React, start
 * Alpine on the subtree, instantiate a web component, etc.
 */
export default function setup(ctx: IslandSetupContext): void {
  const counter = ctx.root.querySelector('[data-counter]');
  const countEl = counter?.querySelector<HTMLElement>('[data-count]');
  const button = counter?.querySelector<HTMLButtonElement>('button');
  if (!counter || !countEl || !button) return;

  let count = 0;
  button.addEventListener('click', () => {
    count += 1;
    countEl.textContent = String(count);
  });

  // Visible-feedback that hydration actually happened, separate from
  // user interaction.
  countEl.textContent = '0 (hydrated)';
}
