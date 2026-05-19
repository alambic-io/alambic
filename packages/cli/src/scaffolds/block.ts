/**
 * Templates for `alambic new block <name>` — a Shopify theme block
 * (lives under `src/blocks/<name>/`, referenced from a section via
 * `block.theme()` or `block.named('<name>')`).
 */
export const BLOCK_INDEX_LIQUID = `<div
  class="alambic-block alambic-block--{{name}}"
  {{ '{{' }} block.shopify_attributes {{ '}}' }}
>
  {{ '{{' }} block.settings.text {{ '}}' }}
</div>
`;

export const BLOCK_SCHEMA_TS = `import { text, themeBlock } from '@alambic/schema';

export default themeBlock({
  name: '{{label}}',
  settings: [
    text({ id: 'text', label: 'Text', default: '{{label}}' }),
  ],
  presets: [{ name: '{{label}}' }],
});
`;
