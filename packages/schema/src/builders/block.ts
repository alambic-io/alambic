import type {
  AppBlockReference,
  LocalBlockDefinition,
  NamedBlockReference,
  ThemeBlockReference,
} from '../types.js';

/**
 * `block({ type, name, settings, ... })` — a section-defined local block.
 *
 * Static helpers:
 *   - `block.theme()` → `"@theme"` reference (any theme block)
 *   - `block.app()`   → `"@app"` reference (any app block)
 *   - `block.named('badge')` → reference to `blocks/badge.liquid`
 */
function blockImpl<const T extends Omit<LocalBlockDefinition, 'kind'>>(
  def: T,
): T & { kind: 'block' } {
  return { ...def, kind: 'block' };
}

interface BlockFn {
  <const T extends Omit<LocalBlockDefinition, 'kind'>>(def: T): T & { kind: 'block' };
  theme(): ThemeBlockReference;
  app(): AppBlockReference;
  named(type: string): NamedBlockReference;
}

const block = blockImpl as unknown as BlockFn;

block.theme = (): ThemeBlockReference => ({ kind: 'block-ref', type: '@theme' });
block.app = (): AppBlockReference => ({ kind: 'block-ref', type: '@app' });
block.named = (type: string): NamedBlockReference => ({ kind: 'block-ref', type });

export { block };
