import { color, text, themeBlock } from '@alambic/schema';

export default themeBlock({
  name: 'Badge',
  settings: [
    text({ id: 'label', label: 'Label', default: 'New' }),
    color({ id: 'background', label: 'Background', default: '#f5f5f5' }),
  ],
  presets: [{ name: 'Badge' }],
});
