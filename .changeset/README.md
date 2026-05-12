# Changesets

This directory holds Changeset files used to drive versioning and changelogs.

- Run `pnpm changeset` after any user-visible change. Pick the affected packages and bump level (`patch`, `minor`, `major`).
- On merge to `main`, CI opens a release PR via the Changesets bot.
- Merging that PR publishes to npm.

Until 1.0, packages are versioned in **fixed** mode under `@alambic/*` so every release moves in lockstep. See root `CLAUDE.md` § 9.
