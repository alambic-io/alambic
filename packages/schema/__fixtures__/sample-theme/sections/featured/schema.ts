import { range, section, text } from '@alambic/schema';

export default section({
  name: 'Featured',
  settings: [
    text({ id: 'heading', label: 'Heading' }),
    range({ id: 'columns', label: 'Columns', min: 1, max: 6, default: 3 }),
  ],
});
