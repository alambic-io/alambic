# @alambic/adapters

CSS + JS adapter contracts for Alambic. **Types and interfaces only — no implementations.**

The wall between Alambic core and a specific runtime stack. Implement these interfaces to build an Alambic preset.

## Install

```bash
pnpm add @alambic/adapters
```

## Usage

```ts
import { defineCssAdapter, defineJsAdapter, definePreset } from '@alambic/adapters';

const css = defineCssAdapter({
  name: 'my-css',
  vitePlugins: (ctx) => [
    /* ...vite plugins... */
  ],
  contentSources: (ctx) => ['**/*.liquid'],
  emitTokens: (settings) => '@theme { /* ... */ }',
  extractCritical: (html, fullCss) => '',
});

const js = defineJsAdapter({
  name: 'my-js',
  vitePlugins: (ctx) => [],
  discoverEntries: (ctx) => [
    /* ...entries... */
  ],
  hydrationRuntime: new URL('./runtime.js', import.meta.url).pathname,
  generateComponentBindings: (section) => '',
});

export const myPreset = definePreset({ name: 'my-preset', css, js });
```

See [`packages/preset-tailwind-alpine`](../preset-tailwind-alpine) for the reference implementation.

## License

MIT
