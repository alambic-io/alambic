import { resolveConfig, setLogLevel, setNoColor } from '@alambic/core';
import { Command } from 'commander';
import { buildCommand } from './commands/build.js';
import { devCommand } from './commands/dev.js';
import { doctor } from './commands/doctor/index.js';
import { lspCommand } from './commands/lsp.js';
import { formatNewResult, newCommand, type NewKind } from './commands/new.js';
import { pullCommand } from './commands/pull.js';
import { pushCommand } from './commands/push.js';
import { formatSchemaCheckHuman, schemaCheckCommand } from './commands/schema-check.js';
import { formatTypesHuman, typesCommand } from './commands/types.js';
import { loadConfig } from './internal/load-config.js';
import { VERSION } from './version.js';

export async function run(argv: readonly string[]): Promise<void> {
  const program = new Command();

  program
    .name('alambic')
    .description('Alambic — a type-safe devkit for Shopify theme development')
    .version(VERSION, '-v, --version', 'output the alambic CLI version')
    // Global flags. Apply across every subcommand.
    .option('--theme-root <path>', 'override `themeRoot` from config (default: ./src)')
    .option('--verbose', 'log debug-level messages (equivalent to ALAMBIC_LOG=debug)')
    .option('--quiet', 'suppress non-error output')
    .option('--no-color', 'disable ANSI colors in output')
    .hook('preAction', (thisCommand) => {
      const opts = thisCommand.opts<{
        themeRoot?: string;
        verbose?: boolean;
        quiet?: boolean;
        color?: boolean; // commander inverts `--no-color` into `color: false`
      }>();
      if (opts.themeRoot) {
        process.env['ALAMBIC_THEME_ROOT'] = opts.themeRoot;
      }
      if (opts.verbose) setLogLevel('debug');
      else if (opts.quiet) setLogLevel('error');
      if (opts.color === false) setNoColor();
    });

  program
    .command('dev')
    .description('Start the dev loop: Vite dev server + shopify theme dev')
    .option('--config <path>', 'path to alambic.config.{ts,mjs,js}')
    .option('--env <name>', 'environment name (loads .env.[name][.local])')
    .option('--no-shopify-cli', 'skip spawning the Shopify CLI subprocess')
    .action(async (opts: { config?: string; env?: string; shopifyCli?: boolean }) => {
      await devCommand({
        cwd: process.cwd(),
        ...(opts.config !== undefined ? { configPath: opts.config } : {}),
        ...(opts.env !== undefined ? { envName: opts.env } : {}),
        noShopifyCli: opts.shopifyCli === false,
      });
    });

  program
    .command('build')
    .description('Build the production theme into .alambic/theme/')
    .option('--config <path>', 'path to alambic.config.{ts,mjs,js}')
    .option('--env <name>', 'environment name (loads .env.[name][.local])')
    .option('--report', 'write alambic-report.json with per-template stats next to the output')
    .action(async (opts: { config?: string; env?: string; report?: boolean }) => {
      await buildCommand({
        cwd: process.cwd(),
        ...(opts.config !== undefined ? { configPath: opts.config } : {}),
        ...(opts.env !== undefined ? { envName: opts.env } : {}),
        ...(opts.report ? { report: true } : {}),
      });
      process.exit(0);
    });

  program
    .command('pull')
    .description(
      'Pull merchant-owned JSON (templates, settings_data, section groups) from an env into local src/ — or sync directly to another env via --into',
    )
    .option('--config <path>', 'path to alambic.config.{ts,mjs,js}')
    .option('--env <name>', 'source environment (where to pull from)')
    .option('--into <name>', 'target environment to push to instead of writing into local src/')
    .option(
      '--only <patterns>',
      'comma-separated `--only` patterns (default: templates/*.json,config/settings_data.json,sections/*.json)',
    )
    .option('--dry-run', 'print the shopify commands without executing them')
    .action(
      async (opts: {
        config?: string;
        env?: string;
        into?: string;
        only?: string;
        dryRun?: boolean;
      }) => {
        await pullCommand({
          cwd: process.cwd(),
          ...(opts.config !== undefined ? { configPath: opts.config } : {}),
          ...(opts.env !== undefined ? { envName: opts.env } : {}),
          ...(opts.into !== undefined ? { intoEnvName: opts.into } : {}),
          ...(opts.only !== undefined ? { only: opts.only } : {}),
          ...(opts.dryRun ? { dryRun: true } : {}),
        });
        process.exit(0);
      },
    );

  program
    .command('push')
    .description('Build then push the staged theme to the active environment')
    .option('--config <path>', 'path to alambic.config.{ts,mjs,js}')
    .option('--env <name>', 'environment name (loads .env.[name][.local])')
    .option('--no-build', 'skip the pre-push build step (use the existing .alambic/theme/)')
    .action(async (opts: { config?: string; env?: string; build?: boolean }) => {
      await pushCommand({
        cwd: process.cwd(),
        ...(opts.config !== undefined ? { configPath: opts.config } : {}),
        ...(opts.env !== undefined ? { envName: opts.env } : {}),
        build: opts.build !== false,
      });
      process.exit(0);
    });

  program
    .command('types')
    .description(
      'Generate .alambic/types/index.d.ts from sections/*/schema.ts and blocks/*/schema.ts',
    )
    .option('--config <path>', 'path to alambic.config.{ts,mjs,js}')
    .option('--json', 'emit machine-readable JSON output')
    .action(async (opts: { config?: string; json?: boolean }) => {
      const result = await typesCommand({
        cwd: process.cwd(),
        ...(opts.config !== undefined ? { configPath: opts.config } : {}),
      });
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        process.stdout.write(formatTypesHuman(result));
      }
    });

  const schemaGroup = program.command('schema').description('Schema commands');
  schemaGroup
    .command('check')
    .description('Validate every section/block schema.ts without building')
    .option('--config <path>', 'path to alambic.config.{ts,mjs,js}')
    .option('--json', 'emit machine-readable JSON output')
    .action(async (opts: { config?: string; json?: boolean }) => {
      const result = await schemaCheckCommand({
        cwd: process.cwd(),
        ...(opts.config !== undefined ? { configPath: opts.config } : {}),
      });
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        const { stdout, stderr } = formatSchemaCheckHuman(result);
        if (stdout) process.stdout.write(stdout);
        if (stderr) process.stderr.write(stderr);
      }
      process.exit(result.ok ? 0 : 1);
    });

  const newGroup = program
    .command('new')
    .description('Scaffold a section, theme block, or snippet from a template');

  newGroup
    .command('section <name>')
    .description('Scaffold src/sections/<name>/ (index.liquid + schema.ts)')
    .option('--config <path>', 'path to alambic.config.{ts,mjs,js}')
    .option('--with-client', 'also create client.ts and index.css for the section')
    .option('--json', 'emit machine-readable JSON output')
    .action(
      async (name: string, opts: { config?: string; withClient?: boolean; json?: boolean }) => {
        await runNew('section', name, opts);
      },
    );

  newGroup
    .command('block <name>')
    .description('Scaffold src/blocks/<name>/ (index.liquid + schema.ts)')
    .option('--config <path>', 'path to alambic.config.{ts,mjs,js}')
    .option('--json', 'emit machine-readable JSON output')
    .action(async (name: string, opts: { config?: string; json?: boolean }) => {
      await runNew('block', name, opts);
    });

  newGroup
    .command('snippet <name>')
    .description('Scaffold src/snippets/<name>.liquid')
    .option('--config <path>', 'path to alambic.config.{ts,mjs,js}')
    .option('--json', 'emit machine-readable JSON output')
    .action(async (name: string, opts: { config?: string; json?: boolean }) => {
      await runNew('snippet', name, opts);
    });

  newGroup
    .command('template <name>')
    .description('Scaffold src/templates/<name>.json (Online Store 2.0)')
    .option('--config <path>', 'path to alambic.config.{ts,mjs,js}')
    .option('--json', 'emit machine-readable JSON output')
    .action(async (name: string, opts: { config?: string; json?: boolean }) => {
      await runNew('template', name, opts);
    });

  program
    .command('lsp')
    .description(
      'Start the Alambic Liquid language server over stdio. Editor-agnostic; LSP/JSON-RPC.',
    )
    .action(() => {
      lspCommand();
    });

  program
    .command('doctor')
    .description('Run workspace + theme health checks')
    .option('--json', 'emit machine-readable JSON output')
    .action(async (opts: { json?: boolean }) => {
      const result = await doctor();
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        for (const line of result.lines) {
          process.stdout.write(`${line}\n`);
        }
      }
      process.exit(result.ok ? 0 : 1);
    });

  await program.parseAsync(argv as string[]);
}

async function runNew(
  kind: NewKind,
  name: string,
  opts: { config?: string; withClient?: boolean; json?: boolean },
): Promise<void> {
  const result = await newCommand(kind, name, {
    cwd: process.cwd(),
    ...(opts.config !== undefined ? { configPath: opts.config } : {}),
    ...(opts.withClient ? { withClient: true } : {}),
  });
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    const { config, cwd } = await loadConfig(process.cwd(), opts.config);
    const resolved = resolveConfig(config, cwd);
    for (const line of formatNewResult(result, resolved.themeRoot)) {
      process.stdout.write(`${line}\n`);
    }
  }
  process.exit(result.written.length === 0 && result.skipped.length > 0 ? 1 : 0);
}
