import { section, text, textarea } from '@alambic/schema';

export default section({
  name: 'Featured',
  tag: 'section',
  settings: [
    text({ id: 'heading', label: 'Heading', default: 'Lazy-loaded island demo' }),
    textarea({
      id: 'description',
      label: 'Description',
      default:
        "This section's JS isn't loaded until the section scrolls into view (within 200px of the viewport). Open DevTools → Network and watch.",
    }),
  ],
  presets: [{ name: 'Featured', category: 'Demo' }],
});
