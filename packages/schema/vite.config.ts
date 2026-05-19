import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: {
      index: 'src/index.ts',
      compile: 'src/compile/index.ts',
      discover: 'src/discover.ts',
      locales: 'src/locales.ts',
    },
    format: ['esm'],
    platform: 'node',
    target: 'node22',
    dts: true,
    sourcemap: true,
    clean: true,
    hash: false,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
