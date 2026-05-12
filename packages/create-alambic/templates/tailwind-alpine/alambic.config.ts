import { defineConfig } from '@alambic/core';
import { tailwindAlpine } from '@alambic/preset-tailwind-alpine';

export default defineConfig({
  preset: tailwindAlpine(),
  themeRoot: './src',
  output: './dist/theme',
});
