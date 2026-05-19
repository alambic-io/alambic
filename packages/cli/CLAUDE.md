# @alambic/cli

> The `alambic` command-line interface. Entry point for everything a developer does day to day.

---

## Purpose

A single CLI that wraps the orchestrator (`@alambic/core`), the generators (`@alambic/schema`, `@alambic/types`), the LSP (`@alambic/lsp`), and the health-check tooling. The CLI is the surface humans (and Claude Code) interact with most.

## Public API

The CLI is invoked as a binary, but it also exports its commands so they can be programmatically invoked from tests or other tools:

```ts
export { run } from './run';
export type { CliCommand, CliContext } from './types';
```

## Commands

Shipped:

| Command | Description |
|---|---|
| `alambic dev` | Boot Vite dev server + spawn `shopify theme dev` reading from `.alambic/theme/`. Live-syncs `src/` → `.alambic/theme/`. |
| `alambic build` | One-shot build into `.alambic/theme/` (staging copy + Vite assets + manifest snippet). Logs a per-template stats table. `--report` writes `.alambic/alambic-report.json`. |
| `alambic push [--env <name>]` | Build then `shopify theme push --path .alambic/theme --store <s> --theme <id>`. Refuses without resolved store + themeId. |
| `alambic pull [--env <name>] [--into <name>]` | Pull merchant-owned JSON (templates, `config/settings_data.json`, section groups) from `--env`. Default target: local `src/`. With `--into <name>`: pull → push directly to that env's remote theme without touching `src/`. `--only <patterns>` overrides the default pattern set; `--dry-run` prints the shopify commands without running them. |
| `alambic types` | One-shot generation of `.alambic/types/index.d.ts` from `sections/*/schema.ts` and `blocks/*/schema.ts`. |
| `alambic schema check` | Validate every section/block schema without building. |
| `alambic new section <name>` | Scaffold `src/sections/<name>/{index.liquid,schema.ts}`. Add `--with-client` for `client.ts` + `index.css`. |
| `alambic new block <name>` | Scaffold `src/blocks/<name>/{index.liquid,schema.ts}` (a Shopify 2.0 theme block). |
| `alambic new snippet <name>` | Scaffold `src/snippets/<name>.liquid`. |
| `alambic new template <name>` | Scaffold `src/templates/<name>.json` (Online Store 2.0). Accepts digit-leading + underscored names + dot-suffixed variants (e.g. `404`, `gift_card`, `product.alternate`). |
| `alambic lsp` | Start the Alambic Liquid language server over stdio. Editor-agnostic; LSP/JSON-RPC. Identical to running the `alambic-lsp` binary that ships with `@alambic/lsp`. See `docs/lsp-setup.md` for per-editor wiring. |
| `alambic doctor` | Workspace + theme health check. |
| `alambic --version` | Print the CLI version. |

Planned (later phases):

| Command | Description | Phase |
|---|---|---|
| `alambic types --refresh` | Invalidate the Admin API type cache and regenerate. | when Admin API integration lands |
| `alambic upgrade` | Upgrade Alambic packages in the consumer project. | future |

Every command will support `--json` for machine-readable output (used by CI and Claude Code). Today only `doctor` honors it.

## Flag conventions

Shipped today:
- `--config <path>` — Override `alambic.config.ts` location. (dev, build, push, pull, types, schema check, new)
- `--env <name>` — Active environment from `environments` in config. (dev, build, push, pull)
- `--into <name>` — For `pull`: target env to push pulled files to instead of writing into `src/`.
- `--only <patterns>` — For `pull`: comma-separated Shopify CLI `--only` patterns.
- `--no-shopify-cli` — Skip spawning the Shopify CLI subprocess. (dev)
- `--no-build` — For `push`: skip the pre-push build step.
- `--with-client` — For `new section`: also create `client.ts` + `index.css`.
- `--report` — For `build`: write `.alambic/alambic-report.json` with per-template stats and budget breaches.
- `--dry-run` — For `pull`: print the shopify commands without executing them.
- `--json` — Machine-readable output. Supported on: `doctor`, `schema check`, `types`, `new section|block|snippet|template`. Not on `build` (use `--report` instead, which writes a richer JSON file) or `push`/`pull` (the Shopify CLI owns stdout; wrapping in JSON would corrupt its output).

Global (apply to every subcommand via a `program.hook('preAction')`):
- `--theme-root <path>` — Override theme source root. Flag > `alambic.config.ts` > `./src`. Implemented via the `ALAMBIC_THEME_ROOT` env var so any reader of `resolveConfig()` (the plugin, the CLI, tests) picks it up uniformly.
- `--verbose` — Set logger level to `debug`. Applies to the orchestrator's plugin logs (`[core]`, `[staging]`, etc.); deliverable output from CLI commands is unaffected.
- `--quiet` — Set logger level to `error`. Same scope as `--verbose`: silences plugin chatter, not the command's primary output.
- `--no-color` — Disable ANSI colors in logger output. Also sets `NO_COLOR=1` / `FORCE_COLOR=0` so downstream tools (consola, chalk) honor it.

## `alambic doctor`

Single source of truth for "is my workspace healthy?". Exit code = 1 on any `fail`, 0 otherwise. Warnings don't fail.

Shipped checks:

1. **Versions** — Node (≥22.12), pnpm (warn if <9), Shopify CLI (fail if missing).
2. **Config** — `alambic.config.{ts,mjs,js}` exists and loads; counts environments and notes the active one.
3. **Gitignore** — `.gitignore` exists and includes `.alambic` (or `.alambic/`, or a prefix match). Warns otherwise. Skipped when there's no config (monorepo root case).
4. **Shopifyignore** — `.shopifyignore` exists in `themeRoot` once the project has merchant-editable JSON (`templates/*.json`). Skipped silently for brand-new projects with no templates.
5. **Theme structure** — Required dirs (`layout/`, `sections/`, `templates/`, `config/`) exist under `themeRoot`; optional dirs (`snippets`, `locales`, `blocks`, `assets`) noted.
6. **Schema sources** — Flags sections / theme blocks that declare *both* a `schema.ts` and an inline `{% schema %}` block in `index.liquid` (the inliner overwrites the inline block, silently).
7. **Environments** — Active env's `store` + `themeId` resolve through `env()` references (warn on missing themeId; fail on missing store).
8. **Types freshness** — `.alambic/types/index.d.ts` is at least as fresh as the most recent `schema.ts`.

Planned (when the relevant feature lands):
- Workspace graph cycles / layer rules — Phase 5+
- `// alambic:generated` file-hash verification — Phase 5+
- CLAUDE.md/public-API drift detection — Phase 6 LSP
- Shopify CLI auth status — when there's a way to interrogate it without prompting

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
├── index.ts                # CLI entry (shebang + run())
├── run.ts                  # Programmatic entry, command registration
├── version.ts              # Generated VERSION constant
├── commands/
│   ├── dev.ts
│   ├── build.ts
│   ├── push.ts
│   ├── pull.ts             # Pull merchant-owned JSON; optional --into for env-sync
│   ├── types.ts
│   ├── schema-check.ts
│   ├── new.ts              # Unified `new <kind> <name>` (section|block|snippet|template)
│   └── doctor/
│       ├── index.ts
│       ├── types.ts
│       ├── format.ts
│       └── checks/
│           ├── versions.ts
│           ├── config.ts
│           ├── gitignore.ts
│           ├── shopifyignore.ts
│           ├── theme-structure.ts
│           ├── schema-source.ts
│           ├── environment.ts
│           └── types-freshness.ts
├── scaffolds/
│   ├── section.ts          # Section index.liquid + schema.ts + optional client.ts/index.css
│   ├── block.ts            # Theme block templates
│   ├── snippet.ts          # Snippet template
│   ├── template.ts         # JSON template stub
│   └── util.ts             # validateName, validateTemplateName, writeScaffold, ...
├── internal/
│   └── load-config.ts      # jiti-backed alambic.config.ts loader
└── output/
    └── consola.ts          # Human-friendly output (json mode lives inline in commands today)
```

## Dependencies

- `@alambic/core` — dev server, build, config loader.
- `@alambic/types` — type-gen for `alambic types` command.
- `@alambic/schema` — `alambic schema check`.
- `commander` — CLI argument parsing.
- `consola` — output.
- `jiti` — runtime TS loader for `alambic.config.ts`.

## Testing

- Each command has tests next to it: `commands/<name>.test.ts`.
- Doctor checks are tested individually under `commands/doctor/checks/<name>.test.ts`, plus an integration test in `commands/doctor/index.test.ts` against synthetic temp workspaces.
- Smoke test: `alambic doctor` on the example theme exits 0 (1 known warning for missing generated types).

## Claude Code notes

- The CLI is the primary surface Claude Code interacts with. Make output predictable.
- `--json` mode is the contract for programmatic consumption. Never change its shape without a changeset.
- Every error in the CLI maps to an `AlambicError` with a stable code, and Claude Code should be able to look up the code in `docs/errors/`.
- New commands must include a `--json` mode and a doctor check that verifies the prerequisites for the command.
- Scaffold templates live in `src/scaffolds/<thing>/`. Templates are themselves snapshot-tested.
- The doctor check suite is meant to grow. Whenever a new failure mode is discovered in support, add a doctor check that catches it.
