/**
 * `alambic new <kind> <name>` — scaffolders for sections, theme blocks,
 * and snippets. Mirrors the alambic convention of nested folders for
 * sections/blocks (so a sibling `schema.ts` / `client.ts` / `index.css`
 * can be added without touching the layout).
 */
import { join } from 'node:path';
import { resolveConfig } from '@alambic/core';
import { loadConfig } from '../internal/load-config.js';
import { BLOCK_INDEX_LIQUID, BLOCK_SCHEMA_TS } from '../scaffolds/block.js';
import {
  SECTION_CLIENT_TS,
  SECTION_INDEX_CSS,
  SECTION_INDEX_LIQUID,
  SECTION_SCHEMA_TS,
} from '../scaffolds/section.js';
import { SNIPPET_LIQUID } from '../scaffolds/snippet.js';
import { TEMPLATE_JSON } from '../scaffolds/template.js';
import { toLabel, validateName, validateTemplateName, writeScaffold } from '../scaffolds/util.js';

export interface NewOptions {
  cwd: string;
  configPath?: string;
  /** `true` to scaffold the optional client.ts + index.css alongside a section. */
  withClient?: boolean;
}

export type NewKind = 'section' | 'block' | 'snippet' | 'template';

export interface NewResult {
  kind: NewKind;
  name: string;
  written: string[];
  skipped: string[];
}

export async function newCommand(
  kind: NewKind,
  name: string,
  options: NewOptions,
): Promise<NewResult> {
  if (kind === 'template') {
    validateTemplateName(name);
  } else {
    validateName(name);
  }
  const { config, cwd } = await loadConfig(options.cwd, options.configPath);
  const resolved = resolveConfig(config, cwd);
  const vars = { name, label: toLabel(name) };

  let files;
  switch (kind) {
    case 'section':
      files = [
        {
          path: join(resolved.themeRoot, 'sections', name, 'index.liquid'),
          template: SECTION_INDEX_LIQUID,
        },
        {
          path: join(resolved.themeRoot, 'sections', name, 'schema.ts'),
          template: SECTION_SCHEMA_TS,
        },
      ];
      if (options.withClient) {
        files.push(
          {
            path: join(resolved.themeRoot, 'sections', name, 'client.ts'),
            template: SECTION_CLIENT_TS,
          },
          {
            path: join(resolved.themeRoot, 'sections', name, 'index.css'),
            template: SECTION_INDEX_CSS,
          },
        );
      }
      break;
    case 'block':
      files = [
        {
          path: join(resolved.themeRoot, 'blocks', name, 'index.liquid'),
          template: BLOCK_INDEX_LIQUID,
        },
        { path: join(resolved.themeRoot, 'blocks', name, 'schema.ts'), template: BLOCK_SCHEMA_TS },
      ];
      break;
    case 'snippet':
      files = [
        { path: join(resolved.themeRoot, 'snippets', `${name}.liquid`), template: SNIPPET_LIQUID },
      ];
      break;
    case 'template':
      files = [
        {
          path: join(resolved.themeRoot, 'templates', `${name}.json`),
          template: TEMPLATE_JSON,
        },
      ];
      break;
  }

  const { written, skipped } = await writeScaffold(files, vars);
  return { kind, name, written, skipped };
}

export function formatNewResult(result: NewResult, themeRoot: string): string[] {
  const lines: string[] = [];
  lines.push(`alambic new ${result.kind}: ${result.name}`);
  if (result.written.length > 0) {
    lines.push('  Created:');
    for (const p of result.written) lines.push(`    + ${relativeTo(p, themeRoot)}`);
  }
  if (result.skipped.length > 0) {
    lines.push('  Skipped (already exists):');
    for (const p of result.skipped) lines.push(`    ! ${relativeTo(p, themeRoot)}`);
  }
  return lines;
}

function relativeTo(absPath: string, base: string): string {
  if (absPath.startsWith(base)) {
    return absPath.slice(base.length).replace(/^\//, '');
  }
  return absPath;
}
