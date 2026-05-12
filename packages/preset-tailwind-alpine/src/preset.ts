import { type Preset, definePreset } from '@alambic/adapters';
import { tailwindCss } from './css/index.js';
import { alpine } from './js/index.js';
import type { TailwindAlpineOptions } from './options.js';

/**
 * The default Alambic preset: Tailwind v4 + Alpine.js, wired through the
 * adapter contract from `@alambic/adapters`.
 */
export function tailwindAlpine(options: TailwindAlpineOptions = {}): Preset {
  return definePreset({
    name: 'tailwind-alpine',
    css: tailwindCss(options.tailwind ?? {}),
    js: alpine(options.alpine ?? {}),
  });
}
