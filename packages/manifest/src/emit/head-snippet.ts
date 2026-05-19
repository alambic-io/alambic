import type { BuildManifest } from '../types.js';

/**
 * Emit `snippets/alambic-head.liquid`.
 *
 * The snippet dispatches on the `template` parameter and emits:
 *   - `<link rel="modulepreload" …>` hints for the section JS chunks
 *     this template will need. The browser starts fetching the chunks
 *     before the `<alambic-island>` element decides to hydrate — saves
 *     a network round-trip when the island goes interactive.
 *
 * What we don't emit yet (deferred to a richer Phase 5):
 *   - `<link rel="preload" as="style">` for per-template CSS chunks —
 *     we don't currently emit per-template CSS; one shared sheet covers
 *     all templates.
 *   - Critical-CSS inlining — needs a server-rendered preview, which
 *     comes with Phase 6.
 *
 * Usage in `layout/theme.liquid`:
 *
 *   {%- assign tpl = template | default: '' -%}
 *   {% render 'alambic-head', template: tpl %}
 */
const HEADER = '{%- comment -%}alambic:generated — do not edit{%- endcomment -%}';

export function renderHeadSnippet(manifest: BuildManifest): string {
  const lines: string[] = [HEADER];
  const handles = Object.keys(manifest.templates).sort();

  if (handles.length === 0) {
    lines.push('{%- comment -%}no templates discovered{%- endcomment -%}\n');
    return lines.join('\n');
  }

  // Liquid's `template` object stringifies to the handle in older
  // contexts and the full `<handle>.<suffix>` in newer ones. To make
  // this snippet robust we coerce explicitly to its `.name`.
  lines.push('{%- assign __alambic_t = template.name | default: template -%}');
  lines.push('{%- case __alambic_t -%}');
  for (const handle of handles) {
    const t = manifest.templates[handle];
    if (!t) continue;
    lines.push(`  {%- when '${escapeLiquid(handle)}' -%}`);
    for (const chunk of t.sectionChunks) {
      lines.push(`<link rel="modulepreload" href="{{ '${escapeLiquid(chunk)}' | asset_url }}">`);
    }
  }
  lines.push('{%- endcase -%}');

  return `${lines.join('\n')}\n`;
}

function escapeLiquid(s: string): string {
  return s.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}
