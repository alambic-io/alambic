# Alambic

> A composable, type-safe devkit for Shopify theme development.
> Built on Shopify CLI and Vite 8. Refines raw Liquid into a typed, islands-architected, performance-budgeted theme.

This file is the root entry point for both human contributors and Claude Code. Read it first. Every package has its own `CLAUDE.md` with package-specific detail.

---

## 1. Mission

Alambic gives a Shopify theme developer the ergonomics of a modern frontend application — typed schemas, hot reload that survives state, per-route bundles, islands, an LSP — while staying inside the Shopify CLI / Liquid runtime. No headless, no Hydrogen, no app-server runtime. Just a much better Liquid theme.

The reference stack is **Tailwind v4 + Alpine.js**, but the runtime stack is pluggable via a single adapter contract so any CSS engine or JS runtime can be swapped in.

## 2. Non-goals

To keep scope sharp, the following are explicitly **out of scope**:

- Headless storefronts (Hydrogen, Remix, Next, Astro).
- Shopify app development (embedded admin apps, Remix/Polaris app templates).
- Shopify Functions, Cart Transform Functions, Customer Account UI extensions.
- Anything requiring a custom Node runtime in production. Production output is always a static theme directory that Shopify CLI can push.

If a feature request needs one of the above, the answer is no.

## 3. Foundations (non-negotiable)

| Concern | Choice |
|---|---|
| Theme runtime | Shopify CLI (`shopify theme dev`, `shopify theme push`) |
| Build engine | Vite 8 |
| Language | TypeScript, strict mode, project references |
| Package manager | pnpm 9+ |
| Monorepo orchestrator | Turborepo |
| Library bundler | tsup |
| Test runner | Vitest |
| Lint + format | Biome |
| Versioning | Changesets |
| CI | GitHub Actions |
| Node | 22 LTS |
| License | MIT |
| npm scope | `@alambic/*` |

Every package targets ESM only. CommonJS is not supported. Every package emits `.d.ts` from source.

## 4. Repository layout

```
alambic/
├── CLAUDE.md                       # This file — read first
├── AGENTS.md                       # Claude Code playbook (common tasks)
├── README.md                       # Public-facing intro
├── LICENSE                         # MIT
├── package.json                    # Workspace root
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json              # Base TS config inherited by packages
├── biome.json
├── .changeset/
├── .claude/                        # Claude Code config & recipes
│   ├── settings.json
│   └── commands/                   # Slash commands for repetitive tasks
├── docs/
│   ├── architecture.md             # System architecture, data flow
│   ├── roadmap.md                  # Phased delivery plan
│   ├── adapters.md                 # Adapter contract reference
│   ├── conventions.md              # Code conventions
│   └── claude-code-workflows.md    # Detailed Claude Code playbook
├── packages/
│   ├── core/                       # Vite plugin entry, orchestrator
│   ├── schema/                     # TS-authored section schemas
│   ├── types/                      # Theme-wide type generation
│   ├── hmr/                        # Section-aware HMR
│   ├── islands/                    # Hydration directives & bundling
│   ├── manifest/                   # Per-template manifest, critical CSS
│   ├── adapters/                   # CSS + JS adapter contracts
│   ├── preset-tailwind-alpine/     # Default preset
│   ├── test-utils/                 # Vitest helpers, preview server
│   ├── lsp/                        # Liquid LSP server
│   ├── cli/                        # `alambic` CLI
│   └── create-alambic/             # `pnpm create alambic` scaffolder
└── examples/
    ├── minimal/                    # Bare-bones consumer theme
    └── tailwind-alpine-theme/      # Reference theme using the default preset
```

## 5. Package boundaries (one-liners)

| Package | Role | Depends on |
|---|---|---|
| `@alambic/core` | Vite plugin, dev server orchestration, build pipeline | `adapters`, `manifest` |
| `@alambic/schema` | Section schema DSL → JSON schema + TS types | — |
| `@alambic/types` | Theme-wide type generation | `schema` |
| `@alambic/hmr` | Section-aware HMR via Section Rendering API | `core` |
| `@alambic/islands` | Hydration directives, per-island bundling | `core`, `adapters` |
| `@alambic/manifest` | Per-template manifest, critical CSS, budgets | — |
| `@alambic/adapters` | CSS + JS adapter contracts | — |
| `@alambic/preset-tailwind-alpine` | Reference preset | `adapters` |
| `@alambic/test-utils` | Vitest helpers, Playwright fixtures, preview server | `schema` |
| `@alambic/lsp` | Liquid LSP server | `schema`, `types` |
| `@alambic/cli` | `alambic dev / build / new / doctor` | `core`, `types` |
| `create-alambic` | Scaffolder | — |

Dependency direction is one-way. Cycles are a build error. See `docs/architecture.md` for the full graph and contracts.

## 6. Principles

1. **Shopify CLI is the source of truth for the theme.** Alambic never replaces it. We drive `shopify theme dev` as a child process, proxy its preview, and inject our Vite middleware. We never re-implement theme upload, theme check, or the Liquid runtime.
2. **No lock-in below the preset layer.** Core knows nothing about Tailwind or Alpine. Everything stack-specific lives in `preset-tailwind-alpine` and is reachable via the adapter contract.
3. **Liquid is the runtime, TypeScript is the authoring layer.** Schemas, components, types, fixtures — all authored in TS. The build emits the Liquid/JSON files Shopify expects.
4. **Per-template intelligence by default.** Bundles, critical CSS, hydration manifests — all scoped to the actual template. Global bundles are an anti-pattern.
5. **Hot reload that respects state.** Anything other than full page reload during dev is a feature, not a hack. Alpine stores survive. Forms survive. Scroll survives.
6. **Claude Code is a first-class contributor.** Every task that a human can do, Claude Code should be able to do with `AGENTS.md` and per-package `CLAUDE.md` alone.
7. **Specifications precede implementation.** Every package has a `CLAUDE.md` defining its public API and internal architecture *before* code is written.

## 7. Working with Alambic — the human path

```bash
# First time
pnpm install
pnpm build           # Build all packages once so workspace links resolve
pnpm dev             # Watch mode across all packages

# Day to day
pnpm --filter @alambic/core dev    # Watch a single package
pnpm test                          # All tests
pnpm --filter @alambic/schema test # One package
pnpm lint                          # Biome check
pnpm typecheck                     # tsc --build across the workspace
pnpm changeset                     # Record a version-bump intent
pnpm release                       # Run by CI on main; do not run locally

# Try the CLI against an example theme
pnpm --filter examples/tailwind-alpine-theme dev
```

## 8. Working with Alambic — the Claude Code path

Read **`AGENTS.md`** for the playbook. Highlights:

- Every package has a `CLAUDE.md`. Always read the target package's `CLAUDE.md` before editing code in it.
- `.claude/commands/` contains slash commands for repetitive tasks: `/add-package`, `/add-section`, `/typecheck-changed`, `/release-notes`, etc.
- The `alambic doctor` CLI command is the single source of truth for "is the workspace healthy." Run it before and after any non-trivial change.
- Tests must pass before any commit. `pnpm test --filter <changed-package>` is the minimum bar.
- Never edit generated files. Generated files have a `// alambic:generated` header and live under `**/.alambic/` directories.

## 9. Versioning and release

- Changesets-driven. Every PR with a user-visible change requires a changeset.
- All packages version in lockstep (`fixed` mode) until 1.0, then independent.
- `latest` tag on npm tracks main. `next` tag tracks the `next` branch for prerelease work.
- Release notes are generated from changesets and edited in PRs against `.changeset/`.

## 10. Style

- TypeScript, strict, `noUncheckedIndexedAccess: true`.
- Functions over classes unless modeling something with genuine identity (LSP server, dev server).
- No default exports in library code. Named exports only.
- Zod (or Valibot — to be decided in `docs/architecture.md`) for runtime validation at adapter boundaries.
- Errors extend a single `AlambicError` base with a stable `code` field for programmatic handling.
- Logs go through `@alambic/core`'s logger. No bare `console.log` in library code.

## 11. Where to go next

- **Architecting?** → `docs/architecture.md`
- **Planning work?** → `docs/roadmap.md`
- **Writing an adapter?** → `docs/adapters.md` and `packages/adapters/CLAUDE.md`
- **Adding a package?** → `AGENTS.md` § "Add a new package"
- **Debugging a failed build?** → `pnpm alambic doctor`
