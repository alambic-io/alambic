/**
 * `alambic doctor` — workspace + theme health check.
 *
 * Composes a fixed pipeline of checks. Each check is independent and
 * returns 0+ `CheckResult`s. Doctor sums them, formats, and exits 0
 * iff there are no `fail` results.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { configCheck } from './checks/config.js';
import { environmentCheck } from './checks/environment.js';
import { gitignoreCheck } from './checks/gitignore.js';
import { schemaSourceCheck } from './checks/schema-source.js';
import { shopifyignoreCheck } from './checks/shopifyignore.js';
import { themeStructureCheck } from './checks/theme-structure.js';
import { typesFreshnessCheck } from './checks/types-freshness.js';
import { versionsCheck } from './checks/versions.js';
import { formatResults } from './format.js';
import type { CheckResult, DoctorContext, DoctorReport } from './types.js';
import { summarize } from './types.js';
import { VERSION } from '../../version.js';

const CHECKS = [
  versionsCheck,
  configCheck,
  gitignoreCheck,
  shopifyignoreCheck,
  themeStructureCheck,
  schemaSourceCheck,
  environmentCheck,
  typesFreshnessCheck,
];

export async function doctor(cwd: string = process.cwd()): Promise<DoctorReport> {
  const ctx: DoctorContext = {
    cwd: resolve(cwd),
    hasConfig: ['alambic.config.ts', 'alambic.config.mjs', 'alambic.config.js'].some((f) =>
      existsSync(resolve(cwd, f)),
    ),
  };

  const all: CheckResult[] = [];
  for (const check of CHECKS) {
    try {
      const results = await check(ctx);
      all.push(...results);
    } catch (err) {
      all.push({
        group: 'Doctor',
        name: check.name || 'unknown',
        severity: 'fail',
        message: `Check threw: ${(err as Error).message}`,
      });
    }
  }

  const { errors, warnings } = summarize(all);
  const formattedLines = formatResults(all);
  const header = `alambic doctor (v${VERSION})`;
  const footer = `${warnings} warning${warnings === 1 ? '' : 's'}, ${errors} error${errors === 1 ? '' : 's'}`;
  const lines = [header, '', ...formattedLines, footer];

  return {
    ok: errors === 0,
    version: VERSION,
    errors,
    warnings,
    results: all,
    lines,
  };
}

// Maintain the old single-export shape so the CLI `run.ts` doesn't change.
export type { DoctorReport as DoctorResult } from './types.js';
