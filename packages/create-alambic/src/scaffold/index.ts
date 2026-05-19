import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { copyTemplate } from './copy.js';

export interface ScaffoldOptions {
  /** Absolute path to the directory to create. */
  target: string;
  /** Template name under `templatesDir`. */
  templateName: string;
  /** Absolute path to the directory holding template subdirectories. */
  templatesDir: string;
  /** Used to fill `{{PROJECT_NAME}}` in template files. */
  projectName: string;
  runInstall: boolean;
  runGitInit: boolean;
}

export async function scaffold(options: ScaffoldOptions): Promise<void> {
  const templatePath = join(options.templatesDir, options.templateName);
  if (!existsSync(templatePath)) {
    throw new Error(
      `Template "${options.templateName}" not found at ${templatePath}. Available templates ship inside the create-alambic package.`,
    );
  }

  process.stdout.write(
    `Scaffolding ${options.projectName} from template "${options.templateName}"...\n`,
  );
  const written = await copyTemplate(templatePath, options.target, {
    PROJECT_NAME: options.projectName,
  });
  process.stdout.write(`  wrote ${written.length} files\n`);

  if (options.runGitInit) {
    await runCommand('git', ['init', '-q'], options.target);
  }

  if (options.runInstall) {
    const pm = detectPackageManager();
    process.stdout.write(`  installing with ${pm}...\n`);
    await runCommand(pm, ['install'], options.target);
  }
}

function detectPackageManager(): 'pnpm' | 'npm' | 'yarn' | 'bun' {
  const ua = process.env['npm_config_user_agent'] ?? '';
  if (ua.startsWith('pnpm/')) return 'pnpm';
  if (ua.startsWith('yarn/')) return 'yarn';
  if (ua.startsWith('bun/')) return 'bun';
  return 'npm';
}

function runCommand(cmd: string, args: ReadonlyArray<string>, cwd: string): Promise<void> {
  return new Promise((res, rej) => {
    const child = spawn(cmd, args as string[], { cwd, stdio: 'inherit' });
    child.once('error', rej);
    child.once('exit', (code) => {
      if (code === 0) res();
      else rej(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
    });
  });
}
