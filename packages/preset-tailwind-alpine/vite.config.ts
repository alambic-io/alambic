import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: {
      index: 'src/index.ts',
      css: 'src/css/index.ts',
      js: 'src/js/index.ts',
      runtime: 'src/runtime/index.ts',
    },
    format: ['esm'],
    platform: 'node',
    target: 'es2022',
    dts: true,
    sourcemap: true,
    clean: true,
    hash: false,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
