import { block, range, section, text } from '@alambic/schema';

export default section({
  name: 'Hero',
  tag: 'section',
  settings: [
    text({ id: 'heading', label: 'Heading', default: 'Welcome to Alambic' }),
    text({
      id: 'subheading',
      label: 'Subheading',
      default: 'A type-safe devkit for Shopify theme development.',
    }),
    range({ id: 'padding', label: 'Padding', min: 0, max: 200, step: 4, unit: 'px', default: 96 }),
  ],
  blocks: [block.theme()],
  presets: [{ name: 'Hero', category: 'Marketing' }],
});
