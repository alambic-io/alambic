import { join } from 'node:path';
import { resolveConfig } from '@alambic/core';
import { generateTypes } from '@alambic/types';
import { loadConfig } from '../internal/load-config.js';

export interface TypesOptions {
  cwd: string;
  configPath?: string;
}

export interface TypesResult {
  readonly outputFile: string;
  readonly sectionCount: number;
  readonly blockCount: number;
  readonly durationMs: number;
}

/**
 * `alambic types` — one-shot generation of `.alambic/types/index.d.ts`
 * from every `sections/*\/schema.ts` and `blocks/*\/schema.ts`.
 *
 * Output lives at `<projectRoot>/.alambic/types/index.d.ts` (sibling to
 * `.alambic/theme/`). Consumers add it to their `tsconfig.json` via
 * `"include": [".alambic/types/**\/*"]`.
 */
export async function typesCommand(options: TypesOptions): Promise<TypesResult> {
  const { config, cwd } = await loadConfig(options.cwd, options.configPath);
  const resolved = resolveConfig(config, cwd);
  const start = Date.now();

  const outputDir = join(cwd, '.alambic', 'types');
  const result = await generateTypes({ themeRoot: resolved.themeRoot, outputDir });

  return {
    outputFile: result.outputFile,
    sectionCount: result.sectionCount,
    blockCount: result.blockCount,
    durationMs: Date.now() - start,
  };
}

export function formatTypesHuman(result: TypesResult): string {
  return (
    `alambic types: ${result.sectionCount} section(s) + ${result.blockCount} block(s)\n` +
    `  → ${result.outputFile}\n` +
    `  done in ${result.durationMs}ms\n`
  );
}
