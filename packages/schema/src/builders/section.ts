import type { SectionDefinition, ThemeBlockDefinition } from '../types.js';

/**
 * Define a section. Returns the definition unchanged, just with a
 * `kind: 'section'` discriminator the compiler uses.
 *
 * The const generic preserves literal types of `settings` and `blocks`
 * arrays, which the type generator uses to derive `Theme.Section<H>`
 * with per-setting types.
 */
export function section<const T extends Omit<SectionDefinition, 'kind'>>(
  def: T,
): T & { kind: 'section' } {
  return { ...def, kind: 'section' };
}

/**
 * Define a theme block (lives under `blocks/<name>/index.liquid`).
 */
export function themeBlock<const T extends Omit<ThemeBlockDefinition, 'kind'>>(
  def: T,
): T & { kind: 'theme-block' } {
  return { ...def, kind: 'theme-block' };
}
