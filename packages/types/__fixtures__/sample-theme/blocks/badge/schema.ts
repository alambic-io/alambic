import { themeBlock, text } from '@alambic/schema';

export default themeBlock({
  name: 'Badge',
  settings: [text({ id: 'text', label: 'Text' })],
});
