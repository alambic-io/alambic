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
| Toolchain | [Vite+](https://viteplus.dev) — single `vp` CLI for dev, build, check, test, pack, run |
| Build engine | Vite 8 (via Vite+) |
| Language | TypeScript, strict mode |
| Package manager | pnpm 9+ |
| Monorepo orchestrator | `vp run` (Vite Task) |
| Library bundler | `vp pack` (tsdown / Rolldown) |
| Test runner | `vp test` (Vitest) |
| Lint + format + typecheck | `vp check` (Oxlint + Oxfmt + tsgolint) |
| Versioning | Changesets |
| CI | GitHub Actions |
| Node | 22.12+ |
| License | MIT |
| npm scope | `@alambic/*` |

Vite+ consolidates the toolchain into one config (`vite.config.ts`) and one CLI (`vp`). Configuration lives in the root and per-package `vite.config.ts` files — no separate `biome.json`, `turbo.json`, `tsup.config.ts`, `vitest.config.ts`, or `.oxlintrc`.

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
├── vite.config.ts                  # Vite+ root config (lint, fmt, shared)
├── tsconfig.base.json              # Base TS config inherited by packages
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
│   ├── _template/                  # Skeleton copied by /add-package
│   ├── core/                       # Vite plugin entry, orchestrator, staging
│   ├── schema/                     # TS-authored section schemas        (Phase 2)
│   ├── types/                      # Theme-wide type generation         (Phase 2)
│   ├── hmr/                        # Section-aware HMR                  (Phase 3)
│   ├── islands/                    # Hydration directives & bundling    (Phase 4)
│   ├── manifest/                   # Per-template manifest, critical CSS (Phase 5)
│   ├── adapters/                   # CSS + JS adapter contracts
│   ├── preset-tailwind-alpine/     # Default preset
│   ├── test-utils/                 # Vitest helpers, preview server     (Phase 6)
│   ├── lsp/                        # Liquid LSP server                  (Phase 7)
│   ├── cli/                        # `alambic` CLI
│   └── create-alambic/             # `pnpm create alambic` scaffolder
└── examples/
    └── tailwind-alpine-theme/      # Reference theme using the default preset
```

**Per-consumer-theme runtime layout**: each consumer theme has a `src/` (authored) and `.alambic/theme/` (alambic-generated, gitignored). The staging dir doubles as the build output — `alambic dev` lives-syncs it from `src/` and `alambic build` rebuilds it in one shot. The Shopify CLI reads from `.alambic/theme/` in both cases. See `docs/architecture.md` § 2–3.

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
pnpm build           # vp run -r build — build everything so workspace links resolve

# Day to day (Vite+: `vp` is the single CLI)
vp run -r build                              # Build all packages
vp run --filter @alambic/core dev            # Watch a single package
vp run -r test                               # Run all tests
vp run --filter @alambic/schema test         # Test one package
vp check                                     # Lint + format + typecheck in one pass
vp check --fix                               # Apply auto-fixes
vp pack                                      # Library packaging for the current package

# Versioning (still Changesets)
pnpm changeset                               # Record a version-bump intent
pnpm release                                 # Run by CI on main; do not run locally

# Try the CLI against an example theme
vp run --filter examples/tailwind-alpine-theme dev
```

## 8. Working with Alambic — the Claude Code path

Read **`AGENTS.md`** for the playbook. Highlights:

- Every package has a `CLAUDE.md`. Always read the target package's `CLAUDE.md` before editing code in it.
- `.claude/commands/` contains slash commands for repetitive tasks: `/add-package`, `/add-section`, `/typecheck-changed`, `/release-notes`, etc.
- The `alambic doctor` CLI command is the single source of truth for "is the workspace healthy." Run it before and after any non-trivial change.
- Tests must pass before any commit. `vp run --filter @alambic/<pkg> test` is the minimum bar.
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
