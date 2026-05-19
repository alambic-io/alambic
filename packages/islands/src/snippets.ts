/**
 * Liquid snippets emitted by the orchestrator into the staging dir.
 *
 * Two snippets:
 *   - `alambic-islands.liquid` — emits the runtime <script> tag AND the
 *     inline manifest. Author renders this once in `layout/theme.liquid`.
 *   - The `<alambic-island>` element itself is authored inline by the
 *     section. No snippet wraps it (Liquid doesn't pass content blocks
 *     to snippets cleanly).
 */
import type { IslandManifest } from './types.js';

export interface IslandsSnippetOptions {
  /**
   * URL the browser should `<script type="module" src="…">` to load the
   * runtime. Dev: `http://localhost:5173/<vite-served-path>`. Build:
   * an `asset_url`-resolved theme asset.
   */
  runtimeScriptTag: string;
  /** The manifest emitted inline as JSON. */
  manifest: IslandManifest;
}

const HEADER = '{%- comment -%}alambic:generated — do not edit{%- endcomment -%}';

/**
 * Render the `alambic-islands.liquid` snippet that the layout calls once.
 *
 * The manifest is inlined as a JSON `<script>` block; the runtime
 * picks it up via `window.__alambic.manifest`. Manifest URLs come pre-
 * resolved for the current build mode.
 */
export function renderIslandsSnippet(options: IslandsSnippetOptions): string {
  const manifestJson = JSON.stringify(options.manifest, null, 0);
  return `${HEADER}
<script>window.__alambic = window.__alambic || {}; window.__alambic.manifest = ${manifestJson};</script>
${options.runtimeScriptTag}
`;
}

/**
 * Convert a build-mode manifest (entry id → asset filename relative to
 * `assets/`) into a manifest with Liquid `asset_url` expressions. The
 * caller wraps the result in a `<script>` block.
 *
 * This is used when emitting the snippet in build mode — the snippet
 * itself is Liquid, so `{{ 'foo.js' | asset_url }}` is interpolated by
 * Shopify at request time.
 */
export function buildManifestToLiquid(
  entries: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [section, assetName] of Object.entries(entries)) {
    out[section] = `{{ '${escapeLiquid(assetName)}' | asset_url }}`;
  }
  return out;
}

function escapeLiquid(s: string): string {
  return s.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

/**
 * Render the snippet using Liquid-interpolated URLs (build mode). Because
 * the URLs are Liquid expressions, the manifest itself can't be plain
 * JSON — it needs to be emitted as a Liquid `capture` that hands the
 * server-rendered string to the script. We assemble it as Liquid here
 * and let Shopify expand the asset_urls.
 */
export function renderIslandsSnippetBuild(args: {
  runtimeAssetName: string;
  /** Mapping section → asset filename (relative to `assets/`). */
  manifest: Readonly<Record<string, string>>;
}): string {
  const lines: string[] = [];
  lines.push(HEADER);
  // Build a JSON-shaped Liquid object so Shopify expands the URLs at
  // render time. Each entry: "section": "{{ '<file>' | asset_url }}"
  const entries = Object.entries(args.manifest)
    .map(
      ([section, file]) =>
        `      "${escapeJson(section)}": "{{ '${escapeLiquid(file)}' | asset_url }}"`,
    )
    .join(',\n');
  lines.push(
    `<script>window.__alambic = window.__alambic || {}; window.__alambic.manifest = { "entries": {\n${entries}\n} };</script>`,
  );
  lines.push(
    `<script type="module" src="{{ '${escapeLiquid(args.runtimeAssetName)}' | asset_url }}"></script>`,
  );
  return `${lines.join('\n')}\n`;
}

function escapeJson(s: string): string {
  return s.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

/**
 * Absolute filesystem path to the compiled browser runtime
 * (`@alambic/islands/dist/runtime.mjs`). Core uses this:
 *   - In dev: read the file and inline its contents in a `<script type="module">`.
 *   - In build: include it as a Vite rollup `input` entry so it ends up
 *     in `assets/alambic-runtime-<hash>.js`.
 */
export function islandsRuntimeEntryPath(): string {
  return new URL('./runtime.mjs', import.meta.url).pathname;
}
