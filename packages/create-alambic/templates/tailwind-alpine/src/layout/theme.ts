import Alpine from 'alpinejs';
import './theme.css';

// Phase 1: bootstrap Alpine from the layout entry. Per-island hydration
// (Phase 4) will move this into the preset's runtime instead.
declare global {
  interface Window {
    Alpine?: typeof Alpine;
  }
}

if (!window.Alpine) {
  window.Alpine = Alpine;
  Alpine.start();
}
