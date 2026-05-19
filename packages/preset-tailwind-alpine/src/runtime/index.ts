/**
 * Browser-side hydration runtime for the Tailwind + Alpine preset.
 *
 * Phase 1 scope: load and start Alpine.js. Per-island hydration
 * strategies (`load`/`idle`/`visible`/`hover`/`media`) land in Phase 4.
 *
 * Consumers ship this runtime by including it from a `<script type="module">`
 * tag, typically via `{% render 'alambic-asset', entry: 'runtime' %}` in
 * `layout/theme.liquid`.
 */
import Alpine from 'alpinejs';

interface BrowserGlobal {
  Alpine?: typeof Alpine;
}

export async function bootAlpine(): Promise<void> {
  const w = globalThis as BrowserGlobal;
  if (w.Alpine) return;
  w.Alpine = Alpine;
  Alpine.start();
}

// Auto-boot when this module is loaded in a browser environment.
if (typeof (globalThis as { document?: unknown }).document !== 'undefined') {
  void bootAlpine();
}
