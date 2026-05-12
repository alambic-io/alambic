/**
 * Generators for the `alambic-asset.liquid` snippet that consumer themes
 * call to include a JS/CSS entry by id:
 *
 *   {% render 'alambic-asset', entry: 'sections/product-card/client' %}
 *
 * Two modes:
 *   - Dev: tags point at the Vite dev server. Snippet is rewritten when
 *     `alambic dev` starts.
 *   - Build: tags point at hashed assets in the theme's `assets/` directory.
 *     The mapping is inlined into the snippet via Liquid `case`. Each
 *     entry can resolve to a JS file and zero or more associated CSS files
 *     (Vite's bundler emits CSS as sibling chunks).
 */

export interface DevSnippetOptions {
  /** Full origin of the Vite dev server, e.g. `http://localhost:5173`. */
  devUrl: string;
  /** Entry ids that should be served from the dev server. */
  entries: ReadonlyArray<{ id: string; file: string }>;
}

export interface BuildManifestEntry {
  /** Asset filename (relative to `assets/`) for the JS chunk, if any. */
  js?: string;
  /** Asset filenames for sibling CSS chunks. */
  css?: ReadonlyArray<string>;
}

export interface BuildSnippetOptions {
  manifest: Readonly<Record<string, BuildManifestEntry>>;
}

const HEADER = '{%- comment -%}alambic:generated — do not edit{%- endcomment -%}';

export function renderDevSnippet(options: DevSnippetOptions): string {
  const base = options.devUrl.replace(/\/$/, '');
  const cases = options.entries
    .map(
      (e) => `  when '${escapeLiquid(e.id)}'
    assign src = '${escapeLiquid(e.file)}'`,
    )
    .join('\n');

  return `${HEADER}
{%- liquid
  if entry == blank
    break
  endif
  assign src = ''
  case entry
${cases}
  endcase
  if src == ''
    echo '<!-- alambic: unknown entry "' | append: entry | append: '" -->'
    break
  endif
-%}
{%- assign url = '${base}/' | append: src -%}
<script type="module" src="${base}/@vite/client"></script>
{%- if src contains '.css' -%}
<link rel="stylesheet" href="{{ url }}">
{%- else -%}
<script type="module" src="{{ url }}"></script>
{%- endif -%}
`;
}

export function renderBuildSnippet(options: BuildSnippetOptions): string {
  const entries = Object.entries(options.manifest);
  if (entries.length === 0) {
    return `${HEADER}\n{%- comment -%}no entries{%- endcomment -%}\n`;
  }

  const jsCases = entries
    .map(([id, entry]) => {
      const js = entry.js ?? '';
      return `  when '${escapeLiquid(id)}'
    assign js_asset = '${escapeLiquid(js)}'
    assign css_assets = '${(entry.css ?? []).map(escapeLiquid).join(',')}'`;
    })
    .join('\n');

  return `${HEADER}
{%- liquid
  if entry == blank
    break
  endif
  assign js_asset = ''
  assign css_assets = ''
  case entry
${jsCases}
  endcase
  if js_asset == '' and css_assets == ''
    echo '<!-- alambic: unknown entry "' | append: entry | append: '" -->'
    break
  endif
-%}
{%- if css_assets != '' -%}
{%- assign css_list = css_assets | split: ',' -%}
{%- for css_file in css_list -%}
<link rel="stylesheet" href="{{ css_file | asset_url }}">
{%- endfor -%}
{%- endif -%}
{%- if js_asset != '' -%}
<script type="module" src="{{ js_asset | asset_url }}"></script>
{%- endif -%}
`;
}

function escapeLiquid(s: string): string {
  return s.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}
