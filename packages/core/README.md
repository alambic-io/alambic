# @alambic/core

> Alambic's orchestrator. Vite plugin entry point, dev server orchestration, build pipeline.

## Install

```bash
pnpm add @alambic/core vite
```

## Usage

```ts
// alambic.config.ts
import { defineConfig } from '@alambic/core';
import { tailwindAlpine } from '@alambic/preset-tailwind-alpine';

export default defineConfig({
  preset: tailwindAlpine(),
  themeRoot: './src',
  output: './dist/theme',
});
```

```ts
// vite.config.ts (only needed if you invoke Vite directly)
import { defineConfig } from 'vite';
import { alambic } from '@alambic/core';
import config from './alambic.config';

export default defineConfig({
  plugins: [alambic(config)],
});
```

In the normal flow you run `alambic dev` / `alambic build` instead; the CLI consumes this package.

## License

MIT
