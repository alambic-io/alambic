/**
 * Opaque branded types for Shopify runtime objects.
 *
 * These are intentionally minimal in Phase 2 — we model them as branded
 * empty interfaces so consumer code can pass them around with type safety
 * but doesn't get false confidence about specific field names. The full
 * structural types belong in Phase 7's LSP integration (which can read
 * Shopify's `theme-liquid-docs` source of truth).
 *
 * Output as a string block at the top of `.alambic/types/index.d.ts`.
 */

export const RUNTIME_TYPES_BLOCK = `// alambic:generated — Shopify runtime object placeholders.
// Phase 7 (LSP) will replace these with full structural types.

declare namespace Shopify {
  interface Image { readonly __shopify: 'image'; readonly src: string; readonly alt: string | null; readonly width: number; readonly height: number; }
  interface Video { readonly __shopify: 'video'; readonly id: string; readonly alt: string | null; readonly aspect_ratio: number; }
  interface VideoUrl { readonly __shopify: 'video_url'; readonly id: string; readonly type: 'youtube' | 'vimeo'; }
  interface Article { readonly __shopify: 'article'; readonly id: number; readonly handle: string; readonly title: string; readonly url: string; }
  interface Blog { readonly __shopify: 'blog'; readonly id: number; readonly handle: string; readonly title: string; readonly url: string; }
  interface Collection { readonly __shopify: 'collection'; readonly id: number; readonly handle: string; readonly title: string; readonly url: string; }
  interface Page { readonly __shopify: 'page'; readonly id: number; readonly handle: string; readonly title: string; readonly url: string; }
  interface Product { readonly __shopify: 'product'; readonly id: number; readonly handle: string; readonly title: string; readonly url: string; readonly available: boolean; }
  interface Linklist { readonly __shopify: 'linklist'; readonly handle: string; readonly title: string; readonly links: ReadonlyArray<{ readonly title: string; readonly url: string }>; }
  interface Metaobject { readonly __shopify: 'metaobject'; readonly id: string; readonly type: string; readonly handle: string; }
  interface Font { readonly __shopify: 'font'; readonly family: string; readonly variants: ReadonlyArray<string>; }
  interface ColorScheme { readonly __shopify: 'color_scheme'; readonly id: string; }
}
`;
