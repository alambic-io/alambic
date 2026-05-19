import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: {
      index: 'src/index.ts',
      runtime: 'src/runtime.ts',
      snippets: 'src/snippets.ts',
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
