# AGENTS.md — Claude Code Playbook

This file is for AI agents (primarily Claude Code) contributing to Alambic. Read `CLAUDE.md` first for project mission and conventions, then read this for *how to do work* on this repo.

The golden rule: **specifications precede implementation, and tests gate completion.** Every task has a definition of done; no task is complete until tests pass and the changeset is recorded.

---

## 0. Before any task

1. Read root `CLAUDE.md`.
2. Read the target package's `CLAUDE.md`.
3. Run `pnpm alambic doctor` to verify the workspace is healthy.
4. Confirm you're on a feature branch (`feat/...`, `fix/...`, `chore/...`), never on `main`.

## 1. Read order for a typical change

When asked to "fix X in `@alambic/Y`":

1. `packages/Y/CLAUDE.md` — package purpose, public API, internal modules.
2. `packages/Y/src/index.ts` — public entry point. This defines the contract; anything not exported here is internal.
3. `packages/Y/src/**/*.test.ts` for the area being changed. Tests document intent.
4. Sibling packages listed in `packages/Y/CLAUDE.md` § "Depends on" — only the parts of their public API actually consumed.

Do **not** open files in unrelated packages unless tests fail there.

## 2. Mental model for the file system

- `src/` — source. Everything in `src/` is authored.
- `dist/` — alambic package build output (per `vp pack`). Never edited.
- `**/.alambic/` — generated artifacts emitted by Alambic against a consumer theme (`.alambic/theme/`, `.alambic/types/`, etc.). Never edited.
- `**/*.generated.ts` — codegen output. Never edited.
- `__fixtures__/` — test fixtures. Mirror real theme layouts.
- `__snapshots__/` — Vitest snapshots. Updated only when intentional with `vp test -u`.

Generated files carry a `// alambic:generated <pkg>@<version> — do not edit` header. If you find yourself wanting to edit one, the answer is to change the generator.

## 3. Common tasks

### 3.1 Add a new package

Use the slash command: `/add-package`. Manual steps for reference:

1. Create `packages/<name>/`.
2. Copy `packages/_template/` contents (package.json, tsconfig.json, vite.config.ts, CLAUDE.md, README.md, src/index.ts).
3. Rename `name` in `package.json` to `@alambic/<name>`.
4. Add the package to the dependency table in root `CLAUDE.md` § 5.
5. Write the `CLAUDE.md` with: purpose, public API surface, internal modules, dependencies, testing approach. **Do this before writing any source code.**
6. Add at least one failing test that defines the smallest piece of the public API.
7. Implement until the test passes.
8. `pnpm changeset` → mark as `minor` (new package).
9. Run `pnpm alambic doctor` — it will verify the package shows up in the workspace graph correctly.

### 3.2 Add a section schema preset

Section presets live in `packages/schema/src/presets/`. Each preset is a function returning a `SectionSchema` fragment.

1. Read `packages/schema/CLAUDE.md` § "Preset authoring."
2. Create `packages/schema/src/presets/<name>.ts`.
3. Export a single function whose name matches the file.
4. Add a fixture under `packages/schema/__fixtures__/presets/<name>/`.
5. Add a snapshot test verifying the emitted JSON schema and TS types.
6. Document the preset in `packages/schema/README.md`.

### 3.3 Add an adapter (CSS or JS)

1. Read `docs/adapters.md` and `packages/adapters/CLAUDE.md`.
2. Adapter packages live outside the monorepo by default. Inside the monorepo, only `preset-tailwind-alpine` exists as the reference.
3. To add a new in-repo preset (e.g. `preset-unocss-stimulus`), use `/add-package` then implement against the contracts in `@alambic/adapters`.
4. The new preset must pass the **adapter conformance test suite** exported from `@alambic/adapters/conformance`. This suite is the contract.

### 3.4 Change a public API

Public APIs are everything re-exported from a package's `src/index.ts`.

1. Open a discussion in `docs/rfcs/` first if the change is non-trivial. Template: `docs/rfcs/_template.md`.
2. Update the package's `CLAUDE.md` to reflect the new API *before* changing code.
3. Update tests to reflect the new behavior. They should fail.
4. Implement.
5. `pnpm changeset` → mark as `major` if breaking, `minor` if additive.
6. Update any consumer packages and `examples/`.
7. Document in `CHANGELOG.md` via changeset description.

### 3.5 Run a focused dev loop

Don't run the full workspace if you only touched one package.

```bash
pnpm --filter @alambic/<pkg>... dev      # ... = include dependents
pnpm --filter @alambic/<pkg> test --watch
```

The `...` suffix in pnpm filters includes everything downstream, which is usually what you want.

### 3.6 Debug a HMR issue

1. Reproduce against `examples/tailwind-alpine-theme`.
2. Set `ALAMBIC_LOG=debug` to enable the verbose HMR logger.
3. Read `packages/hmr/CLAUDE.md` § "Debugging."
4. The HMR payload schema is in `packages/hmr/src/protocol.ts`. If the issue is at the protocol level, add a test in `packages/hmr/src/protocol.test.ts`.

### 3.7 Update a type generator

Type generators live in `packages/types/src/generators/`. Each generator is a pure function: `(input) => GeneratedFile[]`.

1. Read `packages/types/CLAUDE.md` § "Generator contract."
2. Generators must be deterministic. Same input → byte-identical output.
3. Add a fixture under `packages/types/__fixtures__/<generator>/`.
4. Snapshot test the output.
5. Run `pnpm --filter examples/tailwind-alpine-theme alambic types` and verify the regenerated `.alambic/types/` looks right.

## 4. Definition of done

A task is **not done** until:

- [ ] `vp check` passes (lint + format + typecheck in one pass).
- [ ] `vp run --filter @alambic/<pkg>... test` passes.
- [ ] `pnpm alambic doctor` exits 0.
- [ ] A changeset exists if the change is user-visible.
- [ ] The relevant `CLAUDE.md` reflects the new state.
- [ ] If a public API changed, `examples/` and downstream packages compile.

## 5. Anti-patterns (do not do these)

- **Editing generated files.** Change the generator.
- **Reaching into another package's `src/`.** Use its public API. If the API is insufficient, file the gap in the target package's `CLAUDE.md` and either extend it (with tests) or work around it cleanly.
- **Adding a dependency to the wrong layer.** Adapters depend on nothing. Presets depend on adapters. Core depends on adapters + manifest. See root `CLAUDE.md` § 5.
- **Bare `console.log`.** Use the logger from `@alambic/core`.
- **Defaulting to global state.** Pass context explicitly. The Vite plugin instance is the only legitimate carrier of cross-cutting state, and only inside `@alambic/core`.
- **Implementing before specifying.** Write the `CLAUDE.md` section and the failing test first.
- **Sweeping refactors without a changeset.** Even "internal-only" refactors need a changeset marked `patch` so we can ship a release.

## 6. When in doubt

- Ask for human input via PR draft comments rather than guessing on architecture.
- Prefer the smaller change. A `minor` bump is cheaper than a `major`.
- If `pnpm alambic doctor` reports a warning you don't understand, do not silence it — fix it or escalate.

## 7. Slash commands available in `.claude/commands/`

| Command | Purpose |
|---|---|
| `/add-package` | Scaffold a new package from `packages/_template/` |
| `/add-section` | Scaffold a new section in an example theme |
| `/add-rfc` | Open a new RFC document under `docs/rfcs/` |
| `/typecheck-changed` | Run `tsc` only on packages with uncommitted changes |
| `/test-changed` | Run Vitest only on changed packages and dependents |
| `/release-notes` | Generate release notes from pending changesets |
| `/doctor` | Shortcut for `pnpm alambic doctor` |
| `/sync-claude-md` | Verify each package's CLAUDE.md matches its actual public API |
