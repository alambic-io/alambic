/**
 * Templates for `alambic new section <name>`.
 *
 * Scaffolds a nested section folder following alambic conventions:
 *
 *   src/sections/<name>/
 *     index.liquid    — server-rendered markup, reads section.settings
 *     schema.ts       — typed schema → inlined `{% schema %}` block at build
 *     client.ts       — optional Alpine entry, bundled by Vite
 *     index.css       — optional per-section CSS, bundled by Vite
 */
export const SECTION_INDEX_LIQUID = `<section
  class="alambic-section alambic-section--{{name}}"
  data-section-id="{{ '{{' }} section.id {{ '}}' }}"
  data-section-type="{{name}}"
>
  <h2 class="text-2xl font-semibold">{{ '{{' }} section.settings.heading {{ '}}' }}</h2>
</section>
`;

export const SECTION_SCHEMA_TS = `import { section, text } from '@alambic/schema';

export default section({
  name: '{{label}}',
  tag: 'section',
  settings: [
    text({ id: 'heading', label: 'Heading', default: '{{label}}' }),
  ],
  presets: [{ name: '{{label}}' }],
});
`;

export const SECTION_CLIENT_TS = `// {{name}} section client. Bundled by Vite, loaded per-island when
// hydration strategies arrive in Phase 4. For now, importing alpinejs
// from the layout is the practical bootstrap path; this file is a
// placeholder for section-local logic (event handlers, custom Alpine
// data() factories, etc.).

export {};
`;

export const SECTION_INDEX_CSS = `/* {{name}} section styles. Bundled by Vite. */
.alambic-section--{{name}} {
  /* your styles here */
}
`;
