import { Command } from 'commander';
import { buildCommand } from './commands/build.js';
import { devCommand } from './commands/dev.js';
import { doctor } from './commands/doctor.js';
import { VERSION } from './version.js';

export async function run(argv: readonly string[]): Promise<void> {
  const program = new Command();

  program
    .name('alambic')
    .description('Alambic — a type-safe devkit for Shopify theme development')
    .version(VERSION, '-v, --version', 'output the alambic CLI version');

  program
    .command('dev')
    .description('Start the dev loop: Vite dev server + shopify theme dev')
    .option('--config <path>', 'path to alambic.config.{ts,mjs,js}')
    .option('--no-shopify-cli', 'skip spawning the Shopify CLI subprocess')
    .action(async (opts: { config?: string; shopifyCli?: boolean }) => {
      await devCommand({
        cwd: process.cwd(),
        ...(opts.config !== undefined ? { configPath: opts.config } : {}),
        noShopifyCli: opts.shopifyCli === false,
      });
    });

  program
    .command('build')
    .description('Build the production theme into dist/theme/')
    .option('--config <path>', 'path to alambic.config.{ts,mjs,js}')
    .action(async (opts: { config?: string }) => {
      await buildCommand({
        cwd: process.cwd(),
        ...(opts.config !== undefined ? { configPath: opts.config } : {}),
      });
      process.exit(0);
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
