/**
 * Doctor check primitives.
 *
 * Each check is a pure-ish async function: takes a `DoctorContext`,
 * returns an array of `CheckResult`s. Checks should be cheap (< 200ms
 * combined) and idempotent. No mutations.
 */

export type CheckSeverity = 'pass' | 'warn' | 'fail';

export interface CheckResult {
  readonly group: string;
  readonly name: string;
  readonly severity: CheckSeverity;
  readonly message: string;
  readonly hint?: string;
}

export interface DoctorContext {
  /** Absolute path the user ran `alambic doctor` from. */
  readonly cwd: string;
  /** True if `alambic.config.{ts,mjs,js}` exists in cwd. */
  readonly hasConfig: boolean;
}

export type Check = (ctx: DoctorContext) => Promise<CheckResult[]> | CheckResult[];

export interface DoctorReport {
  ok: boolean;
  version: string;
  errors: number;
  warnings: number;
  results: ReadonlyArray<CheckResult>;
  lines: string[];
}

export function summarize(results: ReadonlyArray<CheckResult>): {
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const r of results) {
    if (r.severity === 'fail') errors++;
    else if (r.severity === 'warn') warnings++;
  }
  return { errors, warnings };
}
