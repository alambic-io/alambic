import { text, themeBlock } from '@alambic/schema';

export default themeBlock({
  name: 'Badge',
  settings: [text({ id: 'label', label: 'Label', default: 'New' })],
});
