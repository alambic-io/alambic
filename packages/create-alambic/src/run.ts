import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { scaffold, type ScaffoldOptions } from './scaffold/index.js';

const TEMPLATES_DIR = resolve(fileURLToPath(import.meta.url), '..', '..', 'templates');

export async function run(argv: readonly string[]): Promise<void> {
  const program = new Command();

  program
    .name('create-alambic')
    .description('Scaffold a new Alambic Shopify theme project')
    .argument('[name]', 'target directory and project name')
    .option('--template <name>', 'starter template', 'tailwind-alpine')
    .option('--no-install', 'skip running the package manager install step')
    .option('--no-git', 'skip git init')
    .action(async (rawName: string | undefined, opts: RunOpts) => {
      const name = rawName ?? defaultName();
      const target = resolve(process.cwd(), name);
      if (existsSync(target)) {
        process.stderr.write(`create-alambic: refusing to overwrite ${target}\n`);
        process.exit(1);
      }

      const options: ScaffoldOptions = {
        target,
        templateName: opts.template,
        templatesDir: TEMPLATES_DIR,
        projectName: basename(target),
        runInstall: opts.install !== false,
        runGitInit: opts.git !== false,
      };

      await scaffold(options);
      printNextSteps(name);
    });

  await program.parseAsync(argv as string[]);
}

interface RunOpts {
  template: string;
  install?: boolean;
  git?: boolean;
}

function defaultName(): string {
  return `alambic-theme-${Math.random().toString(36).slice(2, 7)}`;
}

function printNextSteps(name: string): void {
  process.stdout.write(`\n  Next steps:\n    cd ${name}\n    pnpm dev\n\n`);
}
