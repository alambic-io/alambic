# Conventions

Coding and authoring conventions across the monorepo. Enforce these with tooling where possible; document them here when you can't.

---

## 1. TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`.
- Project references on. Each package's `tsconfig.json` extends `tsconfig.base.json` and declares its own `references` array.
- Never use `any`. Use `unknown` and narrow. The only legitimate `any` is inside a clearly-marked `// alambic:any-justification` comment with a reason.
- No `as` casts on public API boundaries. Internal `as` is acceptable when narrowing is genuinely impossible.
- Named exports only in library code. Default exports are reserved for Vite plugin factories where a third-party convention requires them.

## 2. File layout per package

```
packages/<name>/
├── CLAUDE.md                  # Specification, read first
├── README.md                  # User-facing
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts               # Public entry — only exports
│   ├── <feature>/             # Feature-grouped folders
│   │   ├── index.ts
│   │   └── <impl>.ts
│   └── internal/              # Strictly package-private
├── test/                      # Cross-cutting tests (integration)
├── __fixtures__/              # Test fixtures
└── dist/                      # Build output (gitignored)
```

Tests for a unit live next to the unit: `foo.ts` + `foo.test.ts` in the same folder. `test/` is for integration tests that don't belong to a single unit.

## 3. Module conventions

- Each folder has an `index.ts` that re-exports its public surface. No deep imports from siblings.
- Internal-only utilities live under `src/internal/` and are never re-exported from the package's root `index.ts`.
- Cyclic imports between folders are a build error. The dependency graph between feature folders must be a DAG.

## 4. Errors

```ts
import { AlambicError } from '@alambic/core/errors';

throw new AlambicError({
  code: 'ALAMBIC_SCHEMA_INVALID',
  message: 'Section "product-card" schema is invalid: missing required field "settings"',
  hint: 'See docs/schema.md#required-fields',
  cause: zodError,
});
```

- Every error has a stable `code` (UPPER_SNAKE, `ALAMBIC_` prefix).
- `message` is for humans, ends in no period (consola appends a separator).
- `hint` is optional; it's a one-liner with a docs anchor or fix suggestion.
- `cause` chains the underlying error if any.
- The error code becomes searchable in docs at `docs/errors/<code>.md`.

## 5. Logging

```ts
import { createLogger } from '@alambic/core/logger';
const log = createLogger('schema');

log.info('Compiled %d sections', sections.length);
log.debug({ section }, 'Section detail');
log.warn('Deprecated preset usage: %s', preset.name);
log.error(err, 'Failed to compile section');
```

- Logger is created per package with a stable namespace.
- Levels: `error`, `warn`, `info`, `debug`. Default in dev: `info`. Set `ALAMBIC_LOG=debug` for verbose.
- Never use `console.*` in library code. The logger respects `--json` output mode and CI environments.

## 6. Validation

- Runtime validation at every public boundary. Use the project's chosen validator (Zod, locked in `docs/architecture.md`).
- Static types are documentation; runtime validation is enforcement. We do both at public surfaces.
- Internal-only function arguments rely on types alone unless they come from disk/network.

## 7. Generated files

Every generated file has this header:

```ts
// alambic:generated <package>@<version> — do not edit
// source: <relative path or input hash>
// timestamp: <ISO 8601>
```

`pnpm alambic doctor` verifies that no generated file has been hand-edited (by checking source hashes).

## 8. Tests

- Vitest, `describe`/`it`/`expect`. No global mocks.
- Snapshot tests for code generators only. Never for free-form output.
- Each `describe` block matches a single unit of work; no nested `describe` more than two levels deep.
- Fixtures live in `__fixtures__/`, organized by the test that uses them.
- Tests must be deterministic. Time-dependent tests use a frozen clock from `@alambic/test-utils`.
- Integration tests against a real theme run from `test/integration/` and use the example themes as fixtures.

## 9. Commits & branches

- Branch names: `feat/<package>-<short>`, `fix/<package>-<short>`, `chore/<short>`, `docs/<short>`.
- Commit messages follow Conventional Commits, scoped by package: `feat(schema): add range preset bounds validation`.
- One concern per commit. Squash on merge if needed.

## 10. Documentation

- Public APIs documented with TSDoc on the export.
- Every package has a `README.md` for end users and a `CLAUDE.md` for contributors.
- Code samples in markdown live in `docs/snippets/` and are extracted into the published docs site.
- "Why" goes in `CLAUDE.md`. "How to use" goes in `README.md`. Don't duplicate.

## 11. Liquid in Alambic-emitted snippets

Alambic emits Liquid into consumer themes. That Liquid is part of our public API and follows these rules:

- Always use the new syntax compatible with the strict Liquid parser: `{% render 'name', key: value %}`. No `with` or `for` legacy forms.
- All emitted snippets are prefixed `alambic-` to avoid collisions with theme-author code.
- Emitted snippets carry a header comment: `{%- comment -%}alambic:generated{%- endcomment -%}`.
- Whitespace control is explicit: `{%-` / `-%}`. No trailing whitespace lines.

## 12. Performance

- Library code is hot-path code in dev mode. Avoid unnecessary allocations in watchers and middleware.
- Glob with `tinyglobby`, not `globby` (smaller, faster, ESM).
- File I/O is async with `node:fs/promises`. Sync I/O is allowed only at startup and in CLI prelude.
- Cache aggressively in dev (file-content hash → parsed AST). Invalidate on file change events from Vite.

## 13. Public API stability

- Anything exported from `src/index.ts` is public. Anything else is internal.
- Internal symbols can be renamed without a changeset. Public symbols cannot.
- A public symbol marked `@internal` in TSDoc is still public for tooling purposes but exempt from semver — use sparingly.

## 14. Environment variables

Every env var the project reads is documented in `docs/env.md` and validated at process start. Unknown `ALAMBIC_*` vars produce a warning.
