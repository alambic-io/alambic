import { createRequire } from 'node:module';
import {
  type AdapterContext,
  type CssAdapter,
  type ThemeSettings,
  defineCssAdapter,
} from '@alambic/adapters';
import type { Plugin } from 'vite';
import type { TailwindOptions } from '../options.js';

const requireFn = createRequire(import.meta.url);

const DEFAULT_CONTENT_SOURCES = [
  '**/*.liquid',
  '**/*.{ts,tsx,js,jsx}',
  'sections/**/schema.ts',
  'locales/**/*.json',
] as const;

/**
 * Tailwind v4 CSS adapter.
 *
 * Phase 1 scope: wires `@tailwindcss/vite` as the Vite plugin and exposes
 * conventional content sources. Token emission and critical CSS extraction
 * land alongside `@alambic/schema` in Phase 2/5.
 */
export function tailwindCss(options: TailwindOptions = {}): CssAdapter {
  return defineCssAdapter({
    name: 'tailwind-v4',

    vitePlugins(_ctx: AdapterContext): Plugin[] {
      const plugins: Plugin[] = [];
      try {
        const mod = requireFn('@tailwindcss/vite') as
          | { default?: () => Plugin | Plugin[] }
          | (() => Plugin | Plugin[]);
        const fn = typeof mod === 'function' ? mod : (mod.default ?? (mod as never));
        if (typeof fn === 'function') {
          const result = fn();
          if (Array.isArray(result)) plugins.push(...result);
          else plugins.push(result);
        }
      } catch {
        // Peer dep missing; Vite will surface a clearer downstream error.
      }
      return plugins;
    },

    contentSources(_ctx: AdapterContext): string[] {
      return [...DEFAULT_CONTENT_SOURCES, ...(options.content ?? [])];
    },

    emitTokens(_settings: ThemeSettings): string {
      // Phase 2: derive `@theme` variables from settings_data.json
      return '';
    },

    extractCritical(_html: string, _fullCss: string): string {
      // Phase 5: critters integration
      return '';
    },
  });
}
