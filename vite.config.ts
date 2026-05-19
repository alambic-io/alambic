import { defineConfig } from 'vite-plus';

export default defineConfig({
  lint: {
    ignorePatterns: [
      '**/dist/**',
      '**/.alambic/**',
      '**/coverage/**',
      '**/__snapshots__/**',
      '**/*.generated.ts',
      // Templates ship verbatim to scaffolded projects — their tsconfigs
      // resolve to a different root than the monorepo, so don't lint them here.
      'packages/create-alambic/templates/**',
      // The example theme has its own tsconfig with bundler-style resolution
      // for Liquid/CSS imports; let it own its own checking story.
      'examples/**',
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
