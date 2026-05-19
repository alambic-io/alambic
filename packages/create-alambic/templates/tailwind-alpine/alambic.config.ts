import { defineConfig, env } from '@alambic/core';
import { tailwindAlpine } from '@alambic/preset-tailwind-alpine';

export default defineConfig({
  preset: tailwindAlpine(),
  // themeRoot defaults to './src', output defaults to './.alambic/theme'.
  environments: {
    dev: {
      store: env('SHOPIFY_DEV_STORE'),
      themeId: env('SHOPIFY_DEV_THEME_ID'),
      // Only set when the store has a "Coming Soon" password page.
      storePassword: env('SHOPIFY_DEV_STORE_PASSWORD'),
    },
    preprod: {
      store: env('SHOPIFY_PREPROD_STORE'),
      themeId: env('SHOPIFY_PREPROD_THEME_ID'),
      storePassword: env('SHOPIFY_PREPROD_STORE_PASSWORD'),
    },
    prod: {
      store: env('SHOPIFY_PROD_STORE'),
      themeId: env('SHOPIFY_PROD_THEME_ID'),
      storePassword: env('SHOPIFY_PROD_STORE_PASSWORD'),
    },
  },
  defaultEnvironment: 'dev',
});
