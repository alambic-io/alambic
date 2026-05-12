# @alambic/&lt;name&gt;

> One-line purpose: what this package does and why it exists.

---

## Purpose

A short paragraph explaining the package's responsibility within Alambic. Include what it does **not** do (non-goals).

## Public API

Exports from `src/index.ts`:

```ts
export { foo } from './foo.js';
export type { FooOptions } from './foo.js';
```

Everything not exported here is internal.

## Internal modules

```
src/
├── index.ts          # Public exports
├── &lt;feature&gt;/
│   ├── index.ts
│   └── &lt;impl&gt;.ts
└── internal/         # Strictly package-private
```

## Dependencies

- `@alambic/&lt;other&gt;` — what we consume from it.

## Testing

- Unit tests live next to the unit (`foo.ts` + `foo.test.ts`).
- Cross-cutting integration tests live under `test/`.
- Fixtures live under `__fixtures__/`.

## Claude Code notes

- Read this section before editing the package.
- Mention anything subtle: invariants, race conditions, why a workaround exists.
