# @alambic/schema

> TypeScript-authored Shopify section schemas. A typed DSL that compiles to Shopify's JSON schema format and emits matching TS types.

---

## Purpose

Section schemas in stock Shopify are JSON files with no validation, no types, and no composition primitives. `@alambic/schema` replaces them with a typed DSL. One source of truth produces:

1. A Shopify-format `{% schema %}` block inlined inside `.alambic/theme/sections/{section-name}.liquid` (alongside the section markup).
2. A TypeScript declaration registered in the `Theme.Section<H>` namespace (via `@alambic/types`).
3. A Liquid type-hint sidecar consumed by `@alambic/lsp` for autocomplete inside the section's `.liquid` file.

## Public API

```ts
export { section } from './section';
export {
  text, richText, textarea,
  image, video, url, link,
  range, number, checkbox, radio, select,
  color, colorScheme, fontPicker,
  collection, product, blog, article, page,
  metaobject, metaobjectList,
  header, paragraph,
} from './presets';
export { blocks, block } from './blocks';
export { compose, extend } from './composition';
export type {
  SectionSchema, SettingSchema, BlockSchema,
  SectionDefinition, CompiledSection,
} from './types';
```

## DSL example

```ts
import { section, text, image, range, blocks, link } from '@alambic/schema';

export default section({
  name: 'product-card',
  preset: { name: 'Product card', category: 'Product' },
  settings: {
    heading: text({ label: 'Heading', default: 'New arrival' }),
    image: image({ label: 'Image', aspect: '1/1' }),
    rounding: range({ min: 0, max: 32, step: 2, unit: 'px', default: 8 }),
  },
  blocks: blocks({
    badge: {
      name: 'Badge',
      settings: { text: text({ label: 'Badge text' }) },
    },
    cta: {
      name: 'Call to action',
      settings: { label: text(), url: link() },
    },
  }),
});
```

This compiles to:

- An inlined `{% schema %}` block inside `.alambic/theme/sections/product-card.liquid`, in Shopify's exact format.
- Type registration: `Theme.Section<'product-card'>` with full `.settings.*` and `.blocks.*` inference.

## Compilation

The compiler is in `src/compiler/`. It walks a `SectionDefinition` (the object returned by `section()`) and emits the Shopify JSON schema. It's pure: no I/O, deterministic, snapshot-tested.

Inputs:
- A `SectionDefinition` from a user's `schema.ts`.

Outputs:
- A `CompiledSection` containing the JSON schema string, the TS type declaration, and the LSP sidecar JSON.

```ts
export function compileSection(def: SectionDefinition): CompiledSection;
```

`@alambic/core` invokes this per `sections/*/schema.ts` file during dev (in watch mode) and during build.

## Composition

Two primitives:

### `compose`

Merge multiple setting groups into one:

```ts
const seoSettings = {
  metaTitle: text({ label: 'Meta title' }),
  metaDescription: textarea({ label: 'Meta description' }),
};

export default section({
  name: 'landing-hero',
  settings: compose(seoSettings, {
    heading: text({ label: 'Heading' }),
  }),
});
```

### `extend`

Inherit from another section (useful for variants):

```ts
import baseCard from './product-card';

export default section({
  name: 'featured-product-card',
  ...extend(baseCard, {
    settings: { badge: text({ label: 'Badge' }) },
  }),
});
```

## Internal modules

```
src/
├── index.ts
├── section.ts                # `section()` factory
├── presets/
│   ├── index.ts
│   ├── text.ts
│   ├── image.ts
│   ├── range.ts              # validates min < max, step divides range
│   ├── select.ts
│   ├── color.ts
│   ├── metaobject.ts
│   └── ...
├── blocks/
│   ├── index.ts
│   └── compile.ts
├── composition/
│   ├── compose.ts
│   └── extend.ts
├── compiler/
│   ├── index.ts              # public `compileSection`
│   ├── to-shopify-json.ts    # JSON emission
│   ├── to-ts-types.ts        # .d.ts emission
│   └── to-lsp-sidecar.ts     # LSP hint emission
└── internal/
    └── normalize.ts
```

## Dependencies

No runtime dependencies on other Alambic packages. Consumed by:
- `@alambic/types` — reads `CompiledSection` to assemble theme-wide types.
- `@alambic/core` — invokes the compiler.
- `@alambic/lsp` — consumes the LSP sidecar.

## Testing

- Snapshot tests per preset: input DSL call → output JSON schema string.
- Snapshot tests for full sections: `__fixtures__/sections/*.ts` → `__snapshots__/*.json`.
- Unit tests for each preset's validation (e.g. `range` bounds).
- Property-based test: composition is associative, `extend` is type-stable.

## Claude Code notes

- The DSL surface is small but expressive. When adding a preset, mirror the structure of an existing one (e.g. `text.ts`) and add fixtures.
- The compiler must be deterministic. Never use `Date`, `Math.random`, or `Object.entries` ordering assumptions. Use stable iteration.
- Shopify's accepted setting types are listed in `src/internal/shopify-types.ts`. Adding a new preset means mapping to one of these — we don't invent setting types Shopify doesn't accept.
- When in doubt about Shopify's expected JSON shape, the source of truth is `__fixtures__/shopify-reference/`, which contains hand-authored examples copied verbatim from Shopify's docs.
