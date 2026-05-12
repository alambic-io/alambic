import { Command } from 'commander';
import { doctor } from './commands/doctor.js';
import { VERSION } from './version.js';

export async function run(argv: readonly string[]): Promise<void> {
  const program = new Command();

  program
    .name('alambic')
    .description('Alambic — a type-safe devkit for Shopify theme development')
    .version(VERSION, '-v, --version', 'output the alambic CLI version');

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
