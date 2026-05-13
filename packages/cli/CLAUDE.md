# @alambic/cli

> The `alambic` command-line interface. Entry point for everything a developer does day to day.

---

## Purpose

A single CLI that wraps the orchestrator (`@alambic/core`), the generators (`@alambic/schema`, `@alambic/types`), the preview server (`@alambic/test-utils`), and the health-check tooling. The CLI is the surface humans (and Claude Code) interact with most.

## Public API

The CLI is invoked as a binary, but it also exports its commands so they can be programmatically invoked from tests or other tools:

```ts
export { run } from './run';
export type { CliCommand, CliContext } from './types';
```

## Commands

Phase 1 (shipped):

| Command | Description |
|---|---|
| `alambic dev` | Boot Vite dev server + spawn `shopify theme dev` reading from `.alambic/theme/`. Live-syncs `src/` → `.alambic/theme/`. |
| `alambic build` | One-shot build into `.alambic/theme/` (staging copy + Vite assets + manifest snippet). |
| `alambic doctor` | Workspace + theme health check. |
| `alambic --version` | Print the CLI version. |

Planned (later phases):

| Command | Description | Phase |
|---|---|---|
| `alambic build --push` | Build then `shopify theme push --path .alambic/theme`. | 3 |
| `alambic build --report` | Emit `.alambic/report.json` with budgets, asset graph. | 5 |
| `alambic push [--env <name>]` | Push staging dir to a specific environment. | 3 |
| `alambic new section <name>` | Scaffold `src/sections/<name>/` from template. | 2 |
| `alambic new snippet <name>` | Scaffold `src/snippets/<name>.liquid`. | 2 |
| `alambic new template <name>` | Scaffold `src/templates/<name>.json`. | 2 |
| `alambic types` | One-shot type generation. No watch. | 2 |
| `alambic types --refresh` | Invalidate Admin API cache and regenerate. | 2 |
| `alambic schema check` | Validate all section schemas without building. | 2 |
| `alambic preview` | Run the section preview server (`@alambic/test-utils`). | 6 |
| `alambic upgrade` | Upgrade Alambic packages in the consumer project. | future |

Every command will support `--json` for machine-readable output (used by CI and Claude Code). The Phase 1 commands don't yet — flag is reserved.

## Flag conventions

Shipped today:
- `--config <path>` — Override `alambic.config.ts` location. (dev, build)
- `--env <name>` — Active environment from `environments` in config. (dev, build)
- `--no-shopify-cli` — Skip spawning the Shopify CLI subprocess. (dev)
- `--json` — Machine-readable output. (doctor)

Planned:
- `--theme-root <path>` — Override theme source root (default: `./src`).
- `--verbose` — Equivalent to `ALAMBIC_LOG=debug`.
- `--quiet` — Suppress non-error output.
- `--no-color` — Disable ANSI colors.

## `alambic doctor`

The most important command. Single source of truth for "is my workspace healthy?"

Checks (all gated, exit code = 1 on any failure):

1. **Versions** — Node, pnpm, Shopify CLI all on supported versions.
2. **Workspace** — `pnpm-workspace.yaml` lists all packages under `packages/*`.
3. **Dependency graph** — No cycles. Layer rules respected (adapters depends on nothing, etc.).
4. **CLAUDE.md sync** — Each package's CLAUDE.md "Public API" section matches actual exports.
5. **Generated files** — No hand-edits (content hash matches).
6. **Config** — `alambic.config.ts` validates against the Zod schema.
7. **Type-gen freshness** — `.alambic/types/` is not older than its sources.
8. **Shopify CLI** — `shopify --version` succeeds; auth is configured.
9. **Theme structure** — Required directories present (sections, snippets, templates, config, locales, layout).

Output:

```
alambic doctor

Versions
  ✓ Node 22.x
  ✓ pnpm 9.x
  ✓ Shopify CLI 3.x

Workspace
  ✓ 12 packages discovered
  ✓ Dependency graph is a DAG
  ✓ Layer rules respected

Specs
  ✓ All CLAUDE.md files in sync with public APIs

Generated files
  ✓ No hand-edits detected

Config
  ✓ alambic.config.ts validates

Types
  ⚠ .alambic/types/index.d.ts is 12s older than sections/x/schema.ts
    Run: alambic types

Theme
  ✓ Structure looks valid

1 warning, 0 errors
```

## Internal modules

```
src/
├── index.ts                # CLI entry, registers commands
├── run.ts                  # Programmatic entry
├── commands/
│   ├── dev.ts
│   ├── build.ts
│   ├── new-section.ts
│   ├── new-snippet.ts
│   ├── new-template.ts
│   ├── types.ts
│   ├── schema-check.ts
│   ├── doctor/
│   │   ├── index.ts
│   │   ├── checks/
│   │   │   ├── versions.ts
│   │   │   ├── workspace.ts
│   │   │   ├── graph.ts
│   │   │   ├── claude-md-sync.ts
│   │   │   ├── generated-files.ts
│   │   │   ├── config.ts
│   │   │   ├── types-freshness.ts
│   │   │   ├── shopify-cli.ts
│   │   │   └── theme-structure.ts
│   │   └── format.ts
│   ├── preview.ts
│   └── upgrade.ts
├── output/
│   ├── consola.ts          # Human-friendly output
│   └── json.ts             # --json mode
├── scaffolds/
│   ├── section.ts
│   ├── snippet.ts
│   └── template.ts
└── types.ts
```

## Dependencies

- `@alambic/core` — dev server, build.
- `@alambic/types` — type-gen for `alambic types` command.
- `@alambic/schema` — `alambic schema check`.
- `@alambic/test-utils` — `alambic preview`.
- `commander` — CLI argument parsing.
- `consola` — output.

## Testing

- Each command has integration tests in `test/commands/<name>.test.ts`.
- The doctor check suite is exhaustively tested against fixture workspaces with intentional defects.
- Snapshot tests for `--json` output of every command.
- Smoke test in CI: `alambic doctor` on the actual workspace must exit 0.

## Claude Code notes

- The CLI is the primary surface Claude Code interacts with. Make output predictable.
- `--json` mode is the contract for programmatic consumption. Never change its shape without a changeset.
- Every error in the CLI maps to an `AlambicError` with a stable code, and Claude Code should be able to look up the code in `docs/errors/`.
- New commands must include a `--json` mode and a doctor check that verifies the prerequisites for the command.
- Scaffold templates live in `src/scaffolds/<thing>/`. Templates are themselves snapshot-tested.
- The doctor check suite is meant to grow. Whenever a new failure mode is discovered in support, add a doctor check that catches it.
