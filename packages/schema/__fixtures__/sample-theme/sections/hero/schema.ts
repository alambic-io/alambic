import { section, text } from '@alambic/schema';

export default section({
  name: 'Hero',
  settings: [text({ id: 'heading', label: 'Heading', default: 'Welcome' })],
});
