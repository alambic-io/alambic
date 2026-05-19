/**
 * Compile a SectionDefinition (or ThemeBlockDefinition) into the JSON
 * payload Shopify expects inside a `{% schema %}` block.
 *
 * Pure + deterministic: same input always produces byte-identical output.
 * Snapshot tests gate this.
 */
import type {
  BlockDefinition,
  SectionDefinition,
  Setting,
  ThemeBlockDefinition,
} from '../types.js';

/**
 * The shape we serialize. Intentionally `Record<string, unknown>` rather
 * than a typed shape — we're matching Shopify's open-ended JSON dialect,
 * not our own schema.
 */
export type SchemaJson = Record<string, unknown>;

export function compileSection(def: SectionDefinition): SchemaJson {
  const out: SchemaJson = { name: def.name };
  if (def.tag !== undefined) out['tag'] = def.tag;
  if (def.class !== undefined) out['class'] = def.class;
  if (def.limit !== undefined) out['limit'] = def.limit;
  if (def.max_blocks !== undefined) out['max_blocks'] = def.max_blocks;
  if (def.settings && def.settings.length > 0) {
    out['settings'] = def.settings.map(compileSetting);
  }
  if (def.blocks && def.blocks.length > 0) {
    out['blocks'] = def.blocks.map(compileBlock);
  }
  if (def.presets && def.presets.length > 0) {
    out['presets'] = def.presets.map((p) => ({ ...p }));
  }
  if (def.default !== undefined) out['default'] = { ...def.default };
  if (def.enabled_on !== undefined) out['enabled_on'] = { ...def.enabled_on };
  if (def.disabled_on !== undefined) out['disabled_on'] = { ...def.disabled_on };
  if (def.locales !== undefined) out['locales'] = def.locales;
  if (def.templates !== undefined) out['templates'] = [...def.templates];
  return out;
}

export function compileThemeBlock(def: ThemeBlockDefinition): SchemaJson {
  const out: SchemaJson = { name: def.name };
  if (def.tag !== undefined) out['tag'] = def.tag;
  if (def.class !== undefined) out['class'] = def.class;
  if (def.settings && def.settings.length > 0) {
    out['settings'] = def.settings.map(compileSetting);
  }
  if (def.blocks && def.blocks.length > 0) {
    out['blocks'] = def.blocks.map(compileBlock);
  }
  if (def.presets && def.presets.length > 0) {
    out['presets'] = def.presets.map((p) => ({ ...p }));
  }
  if (def.enabled_on !== undefined) out['enabled_on'] = { ...def.enabled_on };
  if (def.disabled_on !== undefined) out['disabled_on'] = { ...def.disabled_on };
  if (def.locales !== undefined) out['locales'] = def.locales;
  return out;
}

function compileSetting(setting: Setting): SchemaJson {
  // Strip our internal `kind` discriminator and copy the rest. The JSON
  // shape mirrors Shopify's docs 1:1.
  const { kind: _kind, ...rest } = setting;
  void _kind;
  return rest;
}

function compileBlock(block: BlockDefinition): SchemaJson {
  if (block.kind === 'block-ref') {
    return { type: block.type };
  }
  const out: SchemaJson = { type: block.type, name: block.name };
  if (block.limit !== undefined) out['limit'] = block.limit;
  if (block.settings && block.settings.length > 0) {
    out['settings'] = block.settings.map(compileSetting);
  }
  if (block.presets && block.presets.length > 0) {
    out['presets'] = block.presets.map((p) => ({ ...p }));
  }
  return out;
}

/**
 * Stringify a schema object the way Shopify themes typically format it:
 * 2-space indent, trailing newline. The orchestrator inlines this inside
 * `{% schema %}{% endschema %}` blocks.
 */
export function stringifySchema(schema: SchemaJson): string {
  return `${JSON.stringify(schema, null, 2)}\n`;
}
