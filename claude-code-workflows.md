# Claude Code Workflows

This document is a deeper companion to `AGENTS.md`. Where `AGENTS.md` is the quick reference, this is the long-form explanation of how Claude Code should work on Alambic, with concrete examples.

---

## 1. The mental model

Alambic is designed so that an AI agent can do meaningful work with three primary sources of truth:

1. **Root `CLAUDE.md`** — project mission, package list, conventions.
2. **Per-package `CLAUDE.md`** — what this package does, what it exposes, how it's organized.
3. **`AGENTS.md`** — task playbook.

When you're asked to do something, the read path is always: root → target package → relevant tests. You should rarely need to read more than ~4 files to understand a change.

## 2. The principle of small, verified moves

Each change should be small enough that you can:

1. State the intent in one sentence.
2. Identify the failing test you'll add.
3. Identify the public API surface affected (if any).
4. Run a focused test loop in under 30 seconds.

If you can't do these, break the task down.

## 3. A worked example: adding `range` validation to the schema DSL

The user asks: *"Add bounds validation to the `range` preset in `@alambic/schema` — `min` must be less than `max`, and `step` must divide the range evenly."*

### Step 1: Read

- Root `CLAUDE.md` § 5 → confirms `@alambic/schema` exists and depends on nothing.
- `packages/schema/CLAUDE.md` → find the "Preset authoring" section and the public API surface. Locate the `range` preset.
- `packages/schema/src/presets/range.ts` → current implementation.
- `packages/schema/src/presets/range.test.ts` → existing tests.

### Step 2: Plan

The change is purely additive validation. Public API doesn't change. No new export. Backwards compatible. Changeset: `patch`.

### Step 3: Write the failing tests first

```ts
// packages/schema/src/presets/range.test.ts
it('rejects min >= max', () => {
  expect(() => range({ min: 10, max: 5 })).toThrow(/min must be less than max/);
});

it('rejects step that does not divide the range evenly', () => {
  expect(() => range({ min: 0, max: 10, step: 3 })).toThrow(/step must divide/);
});
```

Run them. They fail. Good.

### Step 4: Implement

Add validation at the top of the `range` function. Throw `AlambicError` with code `ALAMBIC_SCHEMA_RANGE_INVALID`.

### Step 5: Verify

```bash
pnpm --filter @alambic/schema test
pnpm --filter @alambic/schema typecheck
pnpm lint
pnpm alambic doctor
```

All green.

### Step 6: Changeset

```bash
pnpm changeset
# → patch bump for @alambic/schema
# Summary: "validate min < max and step divisibility in range preset"
```

### Step 7: Add the error to the docs

Create `docs/errors/ALAMBIC_SCHEMA_RANGE_INVALID.md` with the rule and a fix example.

Done. Total touched files: 3 (one new test block, one source edit, one error doc) + 1 changeset.

## 4. Reading order shortcuts

For common tasks, here's the minimum read path:

| Task | Read |
|---|---|
| Fix a bug in `@alambic/X` | `packages/X/CLAUDE.md`, the failing test, the relevant source file |
| Add a feature to `@alambic/X` | Root `CLAUDE.md` § 5, `packages/X/CLAUDE.md`, `AGENTS.md` § 3.4 if public API |
| Add a new package | `AGENTS.md` § 3.1, root `CLAUDE.md` § 4, 5 |
| Add an adapter | `docs/adapters.md`, `packages/adapters/CLAUDE.md`, `packages/preset-tailwind-alpine/src/` |
| Investigate a HMR issue | `packages/hmr/CLAUDE.md`, `packages/hmr/src/protocol.ts`, `docs/architecture.md` § 8 |
| Update a type generator | `packages/types/CLAUDE.md`, the generator file, its snapshot |

## 5. Things to never assume

- **Don't assume a file exists.** Always `view` first. The repo evolves.
- **Don't assume tests cover everything.** When fixing a bug, the fact that no test fails means you need to write one that does.
- **Don't assume `pnpm install` is current.** If you switch branches or change `package.json`, re-install.
- **Don't assume `alambic.config.ts` in an example is canonical.** The conformance fixture in `test-utils` is the canonical config.
- **Don't assume the Shopify CLI is on a stable version.** Pin in `package.json` and document the version in `docs/env.md`.

## 6. When things go wrong

### A test passes locally but fails in CI

- Compare Node versions. CI is 22 LTS exact.
- Compare pnpm versions. Locked via `packageManager` field in root `package.json`.
- Check for filesystem case sensitivity bugs. Linux CI is case-sensitive; macOS dev usually isn't.

### A type error shows up only in a consumer

- Run `pnpm --filter examples/tailwind-alpine-theme typecheck`. Examples are part of the typecheck graph.
- The fix usually belongs in `packages/types` or in the offending package's `index.ts` exports.

### `alambic doctor` reports a warning

- Don't silence it. Each warning has a code and a docs page. Read the page, fix the cause.
- If the warning is wrong, fix `alambic doctor` and add a test that reproduces the false positive.

### HMR fell back to full reload

- Set `ALAMBIC_LOG=debug` and reproduce. The HMR fallback always logs the reason.
- Common causes: Shopify CLI didn't acknowledge the file push, Section Rendering API returned an error, the DOM target node wasn't found.

## 7. The `/sync-claude-md` discipline

After any change that modifies a public API, run `/sync-claude-md`. It compares each package's `CLAUDE.md` § "Public API" against what's actually exported from `src/index.ts` and flags drift.

A `CLAUDE.md` that has drifted from reality is worse than no `CLAUDE.md`. Treat drift as a build failure.

## 8. Working with examples

`examples/tailwind-alpine-theme/` is part of the test surface. Changes that break it are not done, even if all unit tests pass.

```bash
pnpm --filter examples/tailwind-alpine-theme dev      # Manual smoke test
pnpm --filter examples/tailwind-alpine-theme build    # Should succeed
pnpm --filter examples/tailwind-alpine-theme typecheck
```

If you change the public API, update `examples/` in the same PR.

## 9. Releasing

You should almost never run a release locally. CI runs it from `main` on every merge that contains changesets. If you must release locally (e.g. an emergency hotfix), use `pnpm release` and ensure your npm token is scoped to `@alambic`.

## 10. Asking for help

Some changes need human judgment. When in doubt:

- Open a draft PR with the failing tests and a description of the design question.
- Reference the relevant `CLAUDE.md` section that's ambiguous, and propose a clarification.
- Don't merge yourself out of the ambiguity.
