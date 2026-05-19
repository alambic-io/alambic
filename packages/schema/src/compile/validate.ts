/**
 * Static validation of a SectionDefinition before compilation.
 *
 * Catches the cheap mistakes Shopify would otherwise reject at theme
 * push time. Not exhaustive — Shopify's own theme-check is the final
 * arbiter — but covers the common errors.
 */
import type {
  BlockDefinition,
  LocalBlockDefinition,
  SectionDefinition,
  Setting,
  ThemeBlockDefinition,
} from '../types.js';

export interface ValidationIssue {
  /** Severity. `error` blocks compilation; `warning` is logged. */
  severity: 'error' | 'warning';
  /** Stable code, e.g. `ALAMBIC_SCHEMA_DUPLICATE_ID`. */
  code: string;
  /** Human-readable message. */
  message: string;
  /** Path into the schema where the issue lives, dot-separated. */
  path: string;
}

export function validateSection(def: SectionDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  validateSettings(def.settings, 'settings', issues);
  validateBlocks(def.blocks, 'blocks', issues);

  // Section blocks vs theme blocks are mutually exclusive per Shopify docs.
  if (def.blocks && def.blocks.length > 0) {
    const hasTheme = def.blocks.some((b) => b.kind === 'block-ref' && b.type === '@theme');
    const hasLocal = def.blocks.some((b) => b.kind === 'block');
    if (hasTheme && hasLocal) {
      issues.push({
        severity: 'error',
        code: 'ALAMBIC_SCHEMA_LOCAL_AND_THEME_BLOCKS',
        message: 'A section cannot mix locally-defined blocks with `@theme` references. Pick one.',
        path: 'blocks',
      });
    }
  }

  if (def.limit !== undefined && (def.limit < 1 || def.limit > 25)) {
    issues.push({
      severity: 'warning',
      code: 'ALAMBIC_SCHEMA_LIMIT_OUT_OF_RANGE',
      message: `Section limit ${def.limit} is unusual (Shopify accepts 1..25).`,
      path: 'limit',
    });
  }

  return issues;
}

export function validateThemeBlock(def: ThemeBlockDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  validateSettings(def.settings, 'settings', issues);
  validateBlocks(def.blocks, 'blocks', issues);
  return issues;
}

function validateSettings(
  settings: ReadonlyArray<Setting> | undefined,
  basePath: string,
  out: ValidationIssue[],
): void {
  if (!settings) return;
  const seenIds = new Set<string>();
  for (let i = 0; i < settings.length; i++) {
    const s = settings[i]!;
    const path = `${basePath}[${i}]`;

    if (s.type === 'header' || s.type === 'paragraph') continue;

    if (!('id' in s) || typeof s.id !== 'string' || s.id.length === 0) {
      out.push({
        severity: 'error',
        code: 'ALAMBIC_SCHEMA_MISSING_ID',
        message: `Setting at ${path} is missing a required \`id\`.`,
        path,
      });
      continue;
    }
    if (seenIds.has(s.id)) {
      out.push({
        severity: 'error',
        code: 'ALAMBIC_SCHEMA_DUPLICATE_ID',
        message: `Duplicate setting id "${s.id}" at ${path}.`,
        path,
      });
    }
    seenIds.add(s.id);

    // Per-type validation
    if (s.type === 'range') {
      if (s.max <= s.min) {
        out.push({
          severity: 'error',
          code: 'ALAMBIC_SCHEMA_RANGE_INVALID',
          message: `Range "${s.id}" has max (${s.max}) <= min (${s.min}).`,
          path,
        });
      }
      if (s.default < s.min || s.default > s.max) {
        out.push({
          severity: 'error',
          code: 'ALAMBIC_SCHEMA_RANGE_DEFAULT_OUT_OF_BOUNDS',
          message: `Range "${s.id}" default ${s.default} is outside min..max (${s.min}..${s.max}).`,
          path,
        });
      }
    }
    if ((s.type === 'select' || s.type === 'radio') && s.options.length === 0) {
      out.push({
        severity: 'error',
        code: 'ALAMBIC_SCHEMA_EMPTY_OPTIONS',
        message: `${s.type} "${s.id}" has no options.`,
        path,
      });
    }
    if (s.type === 'video_url' && s.accept.length === 0) {
      out.push({
        severity: 'error',
        code: 'ALAMBIC_SCHEMA_VIDEO_URL_EMPTY_ACCEPT',
        message: `video_url "${s.id}" must accept at least one of: youtube, vimeo.`,
        path,
      });
    }
  }
}

function validateBlocks(
  blocks: ReadonlyArray<BlockDefinition> | undefined,
  basePath: string,
  out: ValidationIssue[],
): void {
  if (!blocks) return;
  const seenTypes = new Set<string>();
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    const path = `${basePath}[${i}]`;
    if (b.kind === 'block-ref') {
      if (seenTypes.has(b.type)) {
        out.push({
          severity: 'error',
          code: 'ALAMBIC_SCHEMA_DUPLICATE_BLOCK_TYPE',
          message: `Duplicate block reference "${b.type}" at ${path}.`,
          path,
        });
      }
      seenTypes.add(b.type);
      continue;
    }
    const local = b as LocalBlockDefinition;
    if (!local.type) {
      out.push({
        severity: 'error',
        code: 'ALAMBIC_SCHEMA_MISSING_BLOCK_TYPE',
        message: `Block at ${path} is missing \`type\`.`,
        path,
      });
      continue;
    }
    if (seenTypes.has(local.type)) {
      out.push({
        severity: 'error',
        code: 'ALAMBIC_SCHEMA_DUPLICATE_BLOCK_TYPE',
        message: `Duplicate block type "${local.type}" at ${path}.`,
        path,
      });
    }
    seenTypes.add(local.type);
    validateSettings(local.settings, `${path}.settings`, out);
  }
}

export function hasErrors(issues: ReadonlyArray<ValidationIssue>): boolean {
  return issues.some((i) => i.severity === 'error');
}

export function formatIssue(issue: ValidationIssue): string {
  const prefix = issue.severity === 'error' ? 'error' : 'warn';
  return `[${prefix}] ${issue.code} @ ${issue.path}: ${issue.message}`;
}
