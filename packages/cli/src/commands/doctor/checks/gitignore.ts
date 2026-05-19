/**
 * Verifies the consumer's `.gitignore` covers Alambic's generated paths.
 *
 * `.alambic/` is meant to be ephemeral — it holds the staging copy of
 * the theme (live-synced in dev, rebuilt in build) plus generated types
 * + reports. Committing it is a common mistake and bloats the repo.
 *
 * What we check:
 *   - A `.gitignore` exists in the project root.
 *   - It contains a pattern that ignores `.alambic/` (e.g. `.alambic`,
 *     `.alambic/`, `.alambic/**`). We do *not* require an exact string;
 *     a substring match is enough.
 *
 * Skipped silently when there's no `alambic.config.*` (i.e. running
 * doctor from the monorepo root, not a consumer theme).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Check } from '../types.js';

export const gitignoreCheck: Check = (ctx) => {
  if (!ctx.hasConfig) return [];

  const gitignorePath = resolve(ctx.cwd, '.gitignore');
  if (!existsSync(gitignorePath)) {
    return [
      {
        group: 'Gitignore',
        name: '.gitignore',
        severity: 'warn',
        message: 'No .gitignore in project root.',
        hint: 'Create a .gitignore that includes `.alambic` so the generated theme + types are not committed.',
      },
    ];
  }

  let body = '';
  try {
    body = readFileSync(gitignorePath, 'utf8');
  } catch (err) {
    return [
      {
        group: 'Gitignore',
        name: '.gitignore',
        severity: 'warn',
        message: `Could not read .gitignore: ${(err as Error).message}`,
      },
    ];
  }

  // Treat `.alambic` / `.alambic/` / `.alambic/**` as equivalent matches.
  // We scan non-comment lines only — a literal `.alambic` inside a `#`
  // comment doesn't count.
  const ignored = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .some((l) => l === '.alambic' || l === '.alambic/' || l.startsWith('.alambic/'));

  if (!ignored) {
    return [
      {
        group: 'Gitignore',
        name: '.gitignore',
        severity: 'warn',
        message: '.alambic/ is not in .gitignore.',
        hint: 'Add a line `.alambic` to .gitignore — the staging dir, types, and build reports live there and should not be committed.',
      },
    ];
  }

  return [
    {
      group: 'Gitignore',
      name: '.gitignore',
      severity: 'pass',
      message: '.alambic/ is gitignored.',
    },
  ];
};
