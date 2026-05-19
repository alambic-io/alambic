/**
 * Discover schema.ts files in `themeRoot` and generate an ambient
 * declaration file at `<typesOutput>/index.d.ts` with:
 *
 *   - The Shopify runtime-objects placeholder namespace
 *   - `Theme.Section<H>` mapping each section handle to its settings + blocks
 *   - `Theme.Block<H>` mapping each theme-block handle to its settings
 *   - `Theme.LocaleKey` enumeration of locale keys (Phase 2.5)
 *
 * Pure-ish: the only I/O is reading schema.ts files (via jiti) and
 * writing the .d.ts output. Deterministic for the same input.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  HeaderSetting,
  ParagraphSetting,
  SectionDefinition,
  Setting,
  ThemeBlockDefinition,
} from '@alambic/schema';
import { discoverSchemas } from '@alambic/schema/discover';
import { RUNTIME_TYPES_BLOCK } from './runtime-types.js';
import { settingTypeExpr } from './setting-types.js';

export interface GenerateOptions {
  /** Author's theme root (`src/`). */
  themeRoot: string;
  /** Destination directory for generated types (default `<themeRoot>/.alambic/types`). */
  outputDir?: string;
}

export interface GenerateResult {
  /** Absolute path to the file written. */
  outputFile: string;
  /** Number of sections discovered. */
  sectionCount: number;
  /** Number of theme blocks discovered. */
  blockCount: number;
}

export async function generateTypes(opts: GenerateOptions): Promise<GenerateResult> {
  const outputDir = opts.outputDir ?? join(opts.themeRoot, '.alambic', 'types');

  const { sections, blocks } = await discoverSchemas({ themeRoot: opts.themeRoot });
  const sectionEntries = sections.map((s) => ({ handle: s.handle, def: s.definition }));
  const blockEntries = blocks.map((b) => ({ handle: b.handle, def: b.definition }));

  const content = renderDts(sectionEntries, blockEntries);
  const outputFile = join(outputDir, 'index.d.ts');
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, content, 'utf8');

  return {
    outputFile,
    sectionCount: sectionEntries.length,
    blockCount: blockEntries.length,
  };
}

export function renderDts(
  sections: ReadonlyArray<{ handle: string; def: SectionDefinition }>,
  blocks: ReadonlyArray<{ handle: string; def: ThemeBlockDefinition }>,
): string {
  const sectionEntries = sections.map(({ handle, def }) => ({
    handle,
    settings: renderSettings(def.settings ?? []),
    blocks: renderSectionBlocks(def),
  }));

  const blockEntries = blocks.map(({ handle, def }) => ({
    handle,
    settings: renderSettings(def.settings ?? []),
  }));

  const sectionUnion =
    sectionEntries.length === 0
      ? 'never'
      : sectionEntries.map((e) => JSON.stringify(e.handle)).join(' | ');
  const blockUnion =
    blockEntries.length === 0
      ? 'never'
      : blockEntries.map((e) => JSON.stringify(e.handle)).join(' | ');

  const sectionMap = sectionEntries
    .map(
      (e) => `    ${JSON.stringify(e.handle)}: {
      readonly settings: ${e.settings};
      readonly blocks: ${e.blocks};
    };`,
    )
    .join('\n');

  const blockMap = blockEntries
    .map(
      (e) => `    ${JSON.stringify(e.handle)}: {
      readonly settings: ${e.settings};
    };`,
    )
    .join('\n');

  return `${RUNTIME_TYPES_BLOCK}
// alambic:generated theme types — do not edit. Run \`alambic types\` to regenerate.

declare namespace Theme {
  type SectionHandle = ${sectionUnion};
  type BlockHandle = ${blockUnion};

  interface SectionMap {
${sectionMap || '    // No sections defined.'}
  }

  interface BlockMap {
${blockMap || '    // No theme blocks defined.'}
  }

  type Section<H extends SectionHandle> = SectionMap[H];
  type Block<H extends BlockHandle> = BlockMap[H];
}
`;
}

function renderSettings(settings: ReadonlyArray<Setting>): string {
  const inputs = settings.filter(
    (s): s is Exclude<Setting, HeaderSetting | ParagraphSetting> =>
      s.type !== 'header' && s.type !== 'paragraph',
  );
  if (inputs.length === 0) return '{}';
  const props = inputs
    .map((s) => `        readonly ${JSON.stringify(s.id)}: ${settingTypeExpr(s)};`)
    .join('\n');
  return `{
${props}
      }`;
}

function renderSectionBlocks(def: SectionDefinition): string {
  if (!def.blocks || def.blocks.length === 0) return 'ReadonlyArray<never>';
  // Mixing local and theme-block refs would have failed validation, so
  // we only handle the homogeneous cases here.
  const localTypes = def.blocks
    .filter((b) => b.kind === 'block')
    .map((b) => JSON.stringify(b.type));
  if (localTypes.length > 0) {
    return `ReadonlyArray<{ readonly type: ${localTypes.join(' | ')}; readonly settings: Record<string, unknown> }>`;
  }
  const refTypes = def.blocks
    .filter((b) => b.kind === 'block-ref')
    .map((b) => JSON.stringify(b.type));
  if (refTypes.length === 0) return 'ReadonlyArray<never>';
  return `ReadonlyArray<{ readonly type: ${refTypes.join(' | ')}; readonly settings: Record<string, unknown> }>`;
}
