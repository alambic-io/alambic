import { defineConfig } from 'vite-plus';

export default defineConfig({
  lint: {
    ignorePatterns: [
      '**/dist/**',
      '**/.alambic/**',
      '**/coverage/**',
      '**/__snapshots__/**',
      '**/*.generated.ts',
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    singleQuote: true,
    semi: true,
    trailingComma: 'all',
    printWidth: 100,
    ignorePatterns: [
      '**/dist/**',
      '**/.alambic/**',
      '**/coverage/**',
      '**/__snapshots__/**',
      '**/*.md',
    ],
  },
});
