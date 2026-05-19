# create-alambic

> The project scaffolder. `pnpm create alambic my-theme` produces a working Alambic project ready for `pnpm dev`.

---

## Purpose

The on-ramp. New users go from zero to a running Shopify theme dev server in three commands:

```bash
pnpm create alambic my-theme
cd my-theme
pnpm install && pnpm dev
```

Anything that creates friction in those three commands is a bug.

## Public API

This package has no library exports. It's a binary.

```ts
// src/index.ts
export {};  // intentionally empty
```

The package's `package.json` `bin` field points at `dist/index.js`, which runs the scaffolder.

## Usage

```bash
pnpm create alambic <name> [--template <name>] [--preset <name>] [--no-install] [--git]
```

Flags:

- `--template <name>` — Which starter template to use. Default: `tailwind-alpine`.
- `--preset <name>` — Equivalent to `--template`, kept for clarity.
- `--no-install` — Skip `pnpm install` after scaffold.
- `--git` — Initialize a git repo and make an initial commit (default: on).
- `--shopify-store <store>` — Optional. Pre-populate `.env` with `SHOPIFY_STORE=<store>`.

Interactive mode (no `<name>` argument): runs a prompt for name, template, preset.

## Templates

```
templates/
├── tailwind-alpine/                # Default. Tailwind v4 + Alpine, reference preset.
├── minimal/                        # Bare-bones. No preset; user wires their own.
└── ...
```

Each template is a directory tree that's copied verbatim, with a `template.json` describing variables to substitute and prompts to run.

`template.json`:

```json
{
  "name": "tailwind-alpine",
  "description": "Tailwind v4 + Alpine.js, the reference Alambic stack",
  "variables": {
    "PROJECT_NAME": { "from": "name" },
    "ALAMBIC_VERSION": { "from": "package", "value": "@alambic/cli" }
  },
  "prompts": [
    {
      "name": "shopifyStore",
      "message": "Shopify dev store (you can skip and add later):",
      "default": "",
      "into": ".env",
      "key": "SHOPIFY_STORE"
    }
  ]
}
```

Files inside the template can reference `{{PROJECT_NAME}}` etc. for substitution.

## Internal modules

```
src/
├── index.ts                    # Binary entry
├── cli.ts                      # Argument parsing
├── scaffold/
│   ├── copy.ts                 # Copy template tree with substitution
│   ├── substitute.ts           # {{VAR}} replacement
│   ├── prompts.ts              # Run template prompts
│   └── post.ts                 # post-scaffold: git init, pnpm install
├── templates.ts                # Discover available templates
└── internal/
    └── paths.ts

templates/
├── tailwind-alpine/
│   ├── template.json
│   ├── src/
│   │   ├── sections/
│   │   ├── snippets/
│   │   ├── templates/
│   │   ├── config/
│   │   ├── locales/
│   │   └── layout/
│   ├── alambic.config.ts
│   ├── vite.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── .gitignore
│   ├── .env.example
│   └── README.md
└── minimal/
    └── ...
```

Templates are bundled into the npm package — they're part of the distribution.

## Dependencies

- `commander` — args.
- `consola` / `@clack/prompts` — interactive prompts.

This package does **not** depend on any other `@alambic/*` package at runtime. It writes static files. The generated `package.json` references `@alambic/cli` at the latest published version (looked up at scaffold time, with a fallback to a baked-in version for offline use).

## Testing

- Unit tests for substitution and template discovery.
- Integration tests: scaffold each template into a temp directory, run `pnpm install && vp check && pnpm build` against it, assert success.
- Snapshot tests for generated file lists per template.

## Claude Code notes

- Templates are part of the contract with new users. Changes here are user-visible.
- Don't add features to the scaffolder when they belong in the CLI (e.g. `alambic new section` lives in `@alambic/cli`, not here).
- The substitution syntax is simple by design (`{{VAR}}`). Don't introduce a templating engine — if a template needs logic, fork the template.
- The post-scaffold step runs `pnpm install` by default. Skip it cleanly if `--no-install` is set; don't leave a half-installed state.
- Test the scaffolder against the actual published version of `@alambic/cli` in CI. Catches version-resolution bugs early.
