# @alambic/types

> Theme-wide type generation. Produces a single ambient declaration file that types the entire theme: settings, sections, blocks, locales, metaobjects, metafields, and Storefront API.

---

## Purpose

Every Shopify theme is full of stringly-typed lookups: `settings.colors.primary`, `section.settings.heading`, `metaobject.review.fields.rating`, `'cart.empty' | t`. `@alambic/types` turns every one of these into a fully-typed expression at authoring time.

The output is a single file: `.alambic/types/index.d.ts`, consumed by the consumer's `tsconfig.json`. It is regenerated on every relevant file change in dev, and once at build time.

## Public API

```ts
export { generate, type GenerateOptions, type GenerateResult } from './generate';
export type {
  Generator, GeneratorContext, GeneratedFile,
} from './generator';
export {
  settingsSchemaGenerator,
  settingsDataGenerator,
  sectionsGenerator,
  localesGenerator,
  metaobjectsGenerator,
  metafieldsGenerator,
  storefrontGenerator,
} from './generators';
```

## `generate`

Top-level entry point. Composes all generators and writes the result.

```ts
import { generate } from '@alambic/types';

await generate({
  themeRoot: './src',
  outputDir: '.alambic/types',
  storefront: {
    enabled: true,
    apiVersion: '2026-01',
    accessToken: process.env.STOREFRONT_TOKEN,
  },
});
```

## Generator contract

```ts
export interface Generator<TInput = unknown> {
  readonly name: string;
  readonly inputs: (ctx: GeneratorContext) => Promise<TInput>;
  readonly run: (input: TInput, ctx: GeneratorContext) => Promise<GeneratedFile[]>;
}

export interface GeneratedFile {
  readonly path: string;        // relative to outputDir
  readonly content: string;
  readonly sourceHash: string;  // sha256 of inputs that produced this
}
```

Every generator is a pure function: given the same inputs, produce the same output bytes. This is enforced by snapshot tests.

## Generators

| Generator | Reads | Emits |
|---|---|---|
| `settingsSchemaGenerator` | `config/settings_schema.json` | `Theme.Settings.Schema`, `Theme.SettingKey` |
| `settingsDataGenerator` | `config/settings_data.json` | `Theme.Settings.Current` typed by the schema |
| `sectionsGenerator` | `sections/*/schema.ts` (via `@alambic/schema`) | `Theme.Section<H>`, `Theme.SectionHandle`, `Theme.Block<H, B>` |
| `localesGenerator` | `locales/*.json` | `Theme.LocaleKey`, typed `t(key, params?)` helper |
| `metaobjectsGenerator` | Admin GraphQL introspection (cached) | `Theme.Metaobject<H>`, `Theme.MetaobjectHandle` |
| `metafieldsGenerator` | Admin GraphQL introspection (cached) | `Theme.Metafield<Namespace, Key>` |
| `storefrontGenerator` | Storefront API SDL + user queries | `Storefront.*` (graphql-codegen-style) |

## Generated file structure

```
.alambic/types/
├── index.d.ts                 # Aggregator with the Theme namespace
├── settings.d.ts
├── sections.d.ts
├── locales.d.ts
├── metaobjects.d.ts
├── metafields.d.ts
└── storefront.d.ts
```

Each file carries the `alambic:generated` header. The consumer's `tsconfig.json` adds `.alambic/types` to its `include` array.

## Internal modules

```
src/
├── index.ts
├── generate.ts                # Orchestrator
├── generator.ts               # Generator type and helpers
├── generators/
│   ├── index.ts
│   ├── settings-schema.ts
│   ├── settings-data.ts
│   ├── sections.ts
│   ├── locales.ts
│   ├── metaobjects.ts
│   ├── metafields.ts
│   └── storefront.ts
├── caching/
│   ├── admin-api-cache.ts     # Persistent cache for Admin API introspection
│   └── content-hash.ts
├── emit/
│   ├── header.ts              # alambic:generated header
│   └── format.ts              # Prettier-style formatting for stable output
└── internal/
    └── ts-utils.ts
```

## Caching

Admin API and Storefront API responses are cached locally under `.alambic/cache/` keyed by API version + query hash. The cache survives `pnpm dev` restarts but is invalidated by `alambic types --refresh`.

## Dependencies

- `@alambic/schema` — consumes `CompiledSection` from compiled section schemas.

## Testing

- Snapshot test per generator against `__fixtures__/<generator>/input/` → `__snapshots__/<generator>/output.d.ts`.
- Determinism test: run every generator twice with the same inputs, assert byte-identical output.
- Type-level tests using `tsd` to assert the generated types behave correctly when consumed.

## Claude Code notes

- The generator contract is the most important shape in this package. Don't break it.
- When adding a generator, write the fixture first, then the snapshot, then the implementation. The snapshot is the spec.
- Output formatting is stable — use the `format()` helper from `src/emit/format.ts`. Don't hand-format strings; you'll trip determinism tests.
- Admin API access is optional. Generators that need it must degrade gracefully when no token is configured (emit empty namespaces with a `// no admin api token configured` comment).
