import { relative } from 'node:path';
import { resolveConfig } from '@alambic/core';
import {
  formatIssue,
  hasErrors,
  validateSection,
  validateThemeBlock,
  type ValidationIssue,
} from '@alambic/schema';
import { discoverSchemas } from '@alambic/schema/discover';
import { loadConfig } from '../internal/load-config.js';

export interface SchemaCheckOptions {
  cwd: string;
  configPath?: string;
}

export interface SchemaFileResult {
  /** Path relative to themeRoot, with `/` separators. */
  readonly file: string;
  readonly kind: 'section' | 'theme-block' | 'unknown';
  readonly issues: ReadonlyArray<ValidationIssue>;
  /** True if this file's issues include at least one error. */
  readonly failed: boolean;
}

export interface SchemaCheckResult {
  readonly ok: boolean;
  readonly filesScanned: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly files: ReadonlyArray<SchemaFileResult>;
}

/**
 * `alambic schema check` — validate every section + theme-block schema.
 *
 * Returns a structured result. The CLI layer renders it either as a
 * human-readable summary (default) or as JSON (`--json`).
 */
export async function schemaCheckCommand(options: SchemaCheckOptions): Promise<SchemaCheckResult> {
  const { config, cwd } = await loadConfig(options.cwd, options.configPath);
  const resolved = resolveConfig(config, cwd);

  const { sections, blocks } = await discoverSchemas({ themeRoot: resolved.themeRoot });

  const files: SchemaFileResult[] = [];
  let errorCount = 0;
  let warningCount = 0;

  for (const s of sections) {
    const issues = validateSection(s.definition);
    const failed = hasErrors(issues);
    if (failed) errorCount += issues.filter((i) => i.severity === 'error').length;
    warningCount += issues.filter((i) => i.severity === 'warning').length;
    files.push({
      file: relPath(resolved.themeRoot, s.filePath),
      kind: 'section',
      issues,
      failed,
    });
  }
  for (const b of blocks) {
    const issues = validateThemeBlock(b.definition);
    const failed = hasErrors(issues);
    if (failed) errorCount += issues.filter((i) => i.severity === 'error').length;
    warningCount += issues.filter((i) => i.severity === 'warning').length;
    files.push({
      file: relPath(resolved.themeRoot, b.filePath),
      kind: 'theme-block',
      issues,
      failed,
    });
  }

  files.sort((a, b) => a.file.localeCompare(b.file));

  return {
    ok: errorCount === 0,
    filesScanned: files.length,
    errorCount,
    warningCount,
    files,
  };
}

/** Render the result as human-readable lines + write to the given streams. */
export function formatSchemaCheckHuman(result: SchemaCheckResult): {
  stdout: string;
  stderr: string;
} {
  const out: string[] = [];
  const err: string[] = [];
  for (const f of result.files) {
    if (f.issues.length === 0) {
      out.push(`✓ ${f.file}`);
      continue;
    }
    if (f.failed) {
      err.push(`✗ ${f.file}`);
      for (const i of f.issues) err.push(`  ${formatIssue(i)}`);
    } else {
      out.push(`! ${f.file} (warnings)`);
      for (const i of f.issues) out.push(`  ${formatIssue(i)}`);
    }
  }
  out.push('');
  out.push(
    `${result.filesScanned} file(s) scanned, ${result.errorCount} error(s), ${result.warningCount} warning(s)`,
  );
  return { stdout: `${out.join('\n')}\n`, stderr: err.length > 0 ? `${err.join('\n')}\n` : '' };
}

function relPath(themeRoot: string, abs: string): string {
  return relative(themeRoot, abs).replace(/\\/g, '/');
}
