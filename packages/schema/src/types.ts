/**
 * TypeScript shape of every Shopify schema setting type. Mirrors the JSON
 * format that ends up in `{% schema %}` blocks.
 *
 * Each `*Setting` interface has `kind: 'setting'` so the compiler can
 * walk a SectionDefinition's children without ambiguity.
 *
 * `id` is required on every input setting and used as the access key in
 * Liquid (`section.settings.<id>`). `header` and `paragraph` are visual
 * dividers — they have no `id`.
 */

/** A translation key reference, e.g. `'t:settings_schema.theme_color.label'`. */
export type LocaleString = string;

/* ─── Basic inputs ───────────────────────────────────────────────────── */

export interface TextSetting {
  kind: 'setting';
  type: 'text';
  id: string;
  label: LocaleString;
  default?: string;
  placeholder?: LocaleString;
  info?: LocaleString;
}

export interface TextareaSetting {
  kind: 'setting';
  type: 'textarea';
  id: string;
  label: LocaleString;
  default?: string;
  placeholder?: LocaleString;
  info?: LocaleString;
}

export interface NumberSetting {
  kind: 'setting';
  type: 'number';
  id: string;
  label: LocaleString;
  default?: number;
  placeholder?: LocaleString;
  info?: LocaleString;
}

export interface CheckboxSetting {
  kind: 'setting';
  type: 'checkbox';
  id: string;
  label: LocaleString;
  default?: boolean;
  info?: LocaleString;
}

export interface RangeSetting {
  kind: 'setting';
  type: 'range';
  id: string;
  label: LocaleString;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  default: number;
  info?: LocaleString;
}

export interface SelectOption {
  value: string;
  label: LocaleString;
  group?: LocaleString;
}

export interface SelectSetting {
  kind: 'setting';
  type: 'select';
  id: string;
  label: LocaleString;
  options: ReadonlyArray<SelectOption>;
  default?: string;
  info?: LocaleString;
}

export interface RadioSetting {
  kind: 'setting';
  type: 'radio';
  id: string;
  label: LocaleString;
  options: ReadonlyArray<SelectOption>;
  default?: string;
  info?: LocaleString;
}

/* ─── Rich text inputs ───────────────────────────────────────────────── */

export interface RichtextSetting {
  kind: 'setting';
  type: 'richtext';
  id: string;
  label: LocaleString;
  default?: string;
  info?: LocaleString;
}

export interface InlineRichtextSetting {
  kind: 'setting';
  type: 'inline_richtext';
  id: string;
  label: LocaleString;
  default?: string;
  placeholder?: LocaleString;
  info?: LocaleString;
}

export interface HtmlSetting {
  kind: 'setting';
  type: 'html';
  id: string;
  label: LocaleString;
  default?: string;
  placeholder?: LocaleString;
  info?: LocaleString;
}

export interface LiquidSetting {
  kind: 'setting';
  type: 'liquid';
  id: string;
  label: LocaleString;
  default?: string;
  info?: LocaleString;
}

/* ─── Media ──────────────────────────────────────────────────────────── */

export interface ImagePickerSetting {
  kind: 'setting';
  type: 'image_picker';
  id: string;
  label: LocaleString;
  info?: LocaleString;
}

export interface VideoSetting {
  kind: 'setting';
  type: 'video';
  id: string;
  label: LocaleString;
  info?: LocaleString;
}

export interface VideoUrlSetting {
  kind: 'setting';
  type: 'video_url';
  id: string;
  label: LocaleString;
  accept: ReadonlyArray<'youtube' | 'vimeo'>;
  default?: string;
  placeholder?: LocaleString;
  info?: LocaleString;
}

/* ─── Resource pickers ───────────────────────────────────────────────── */

export interface ArticleSetting {
  kind: 'setting';
  type: 'article';
  id: string;
  label: LocaleString;
  info?: LocaleString;
}

export interface ArticleListSetting {
  kind: 'setting';
  type: 'article_list';
  id: string;
  label: LocaleString;
  limit?: number;
  info?: LocaleString;
}

export interface BlogSetting {
  kind: 'setting';
  type: 'blog';
  id: string;
  label: LocaleString;
  info?: LocaleString;
}

export interface CollectionSetting {
  kind: 'setting';
  type: 'collection';
  id: string;
  label: LocaleString;
  info?: LocaleString;
}

export interface CollectionListSetting {
  kind: 'setting';
  type: 'collection_list';
  id: string;
  label: LocaleString;
  limit?: number;
  info?: LocaleString;
}

export interface PageSetting {
  kind: 'setting';
  type: 'page';
  id: string;
  label: LocaleString;
  info?: LocaleString;
}

export interface ProductSetting {
  kind: 'setting';
  type: 'product';
  id: string;
  label: LocaleString;
  info?: LocaleString;
}

export interface ProductListSetting {
  kind: 'setting';
  type: 'product_list';
  id: string;
  label: LocaleString;
  limit?: number;
  info?: LocaleString;
}

export interface LinkListSetting {
  kind: 'setting';
  type: 'link_list';
  id: string;
  label: LocaleString;
  default?: 'main-menu' | 'footer';
  info?: LocaleString;
}

export interface UrlSetting {
  kind: 'setting';
  type: 'url';
  id: string;
  label: LocaleString;
  default?: string;
  info?: LocaleString;
}

export interface MetaobjectSetting {
  kind: 'setting';
  type: 'metaobject';
  id: string;
  label: LocaleString;
  metaobject_type: string;
  info?: LocaleString;
}

export interface MetaobjectListSetting {
  kind: 'setting';
  type: 'metaobject_list';
  id: string;
  label: LocaleString;
  metaobject_type: string;
  limit?: number;
  info?: LocaleString;
}

/* ─── Color ──────────────────────────────────────────────────────────── */

export interface ColorSetting {
  kind: 'setting';
  type: 'color';
  id: string;
  label: LocaleString;
  default?: string;
  info?: LocaleString;
}

export interface ColorBackgroundSetting {
  kind: 'setting';
  type: 'color_background';
  id: string;
  label: LocaleString;
  default?: string;
  info?: LocaleString;
}

export interface ColorSchemeSetting {
  kind: 'setting';
  type: 'color_scheme';
  id: string;
  label: LocaleString;
  default?: string;
  info?: LocaleString;
}

export interface ColorSchemeGroupSetting {
  kind: 'setting';
  type: 'color_scheme_group';
  id: string;
  definition: ReadonlyArray<ColorSetting | ColorBackgroundSetting>;
  role: Readonly<Record<string, string>>;
  info?: LocaleString;
}

/* ─── Typography ─────────────────────────────────────────────────────── */

export interface FontPickerSetting {
  kind: 'setting';
  type: 'font_picker';
  id: string;
  label: LocaleString;
  default: string;
  info?: LocaleString;
}

/* ─── Other ──────────────────────────────────────────────────────────── */

export interface TextAlignmentSetting {
  kind: 'setting';
  type: 'text_alignment';
  id: string;
  label: LocaleString;
  default?: 'left' | 'center' | 'right';
  info?: LocaleString;
}

/** Visual divider with a heading. No `id`. */
export interface HeaderSetting {
  kind: 'setting';
  type: 'header';
  content: LocaleString;
  info?: LocaleString;
}

/** Visual paragraph of informational text. No `id`. */
export interface ParagraphSetting {
  kind: 'setting';
  type: 'paragraph';
  content: LocaleString;
}

/* ─── Discriminated union of every setting ──────────────────────────── */

export type Setting =
  | TextSetting
  | TextareaSetting
  | NumberSetting
  | CheckboxSetting
  | RangeSetting
  | SelectSetting
  | RadioSetting
  | RichtextSetting
  | InlineRichtextSetting
  | HtmlSetting
  | LiquidSetting
  | ImagePickerSetting
  | VideoSetting
  | VideoUrlSetting
  | ArticleSetting
  | ArticleListSetting
  | BlogSetting
  | CollectionSetting
  | CollectionListSetting
  | PageSetting
  | ProductSetting
  | ProductListSetting
  | LinkListSetting
  | UrlSetting
  | MetaobjectSetting
  | MetaobjectListSetting
  | ColorSetting
  | ColorBackgroundSetting
  | ColorSchemeSetting
  | ColorSchemeGroupSetting
  | FontPickerSetting
  | TextAlignmentSetting
  | HeaderSetting
  | ParagraphSetting;

/** Input settings — those with an `id`, used in `section.settings.<id>`. */
export type InputSetting = Exclude<Setting, HeaderSetting | ParagraphSetting>;

/* ─── Block definitions ──────────────────────────────────────────────── */

export interface BlockPreset {
  name: LocaleString;
  settings?: Readonly<Record<string, unknown>>;
}

/** A local (section-defined) block. */
export interface LocalBlockDefinition {
  kind: 'block';
  type: string;
  name: LocaleString;
  limit?: number;
  settings?: ReadonlyArray<Setting>;
  presets?: ReadonlyArray<BlockPreset>;
}

/** A "@theme" reference — accept any theme block in `blocks/`. */
export interface ThemeBlockReference {
  kind: 'block-ref';
  type: '@theme';
}

/** An "@app" reference — accept any app block. */
export interface AppBlockReference {
  kind: 'block-ref';
  type: '@app';
}

/** A reference to a specific theme block by name (`blocks/<name>.liquid`). */
export interface NamedBlockReference {
  kind: 'block-ref';
  type: string;
}

export type BlockDefinition =
  | LocalBlockDefinition
  | ThemeBlockReference
  | AppBlockReference
  | NamedBlockReference;

/* ─── Section + theme block ──────────────────────────────────────────── */

export interface SectionPreset {
  name: LocaleString;
  category?: LocaleString;
  settings?: Readonly<Record<string, unknown>>;
  blocks?: ReadonlyArray<{ type: string; settings?: Readonly<Record<string, unknown>> }>;
}

export interface SectionEnabledOn {
  templates?: ReadonlyArray<string>;
  groups?: ReadonlyArray<string>;
}

export interface SectionDefinition {
  kind: 'section';
  name: LocaleString;
  tag?: 'article' | 'aside' | 'div' | 'footer' | 'header' | 'section';
  class?: string;
  limit?: number;
  max_blocks?: number;
  settings?: ReadonlyArray<Setting>;
  blocks?: ReadonlyArray<BlockDefinition>;
  presets?: ReadonlyArray<SectionPreset>;
  default?: { settings?: Readonly<Record<string, unknown>> };
  enabled_on?: SectionEnabledOn;
  disabled_on?: SectionEnabledOn;
  locales?: Readonly<Record<string, Record<string, string>>>;
  templates?: ReadonlyArray<string>;
}

/**
 * A theme block (file under `blocks/<name>.liquid` or
 * `blocks/<name>/index.liquid`). Theme blocks accept their own settings
 * and may declare which nested block types they accept.
 */
export interface ThemeBlockDefinition {
  kind: 'theme-block';
  name: LocaleString;
  tag?: string;
  class?: string;
  settings?: ReadonlyArray<Setting>;
  /** Which block types this block can nest. Use `@theme` for any. */
  blocks?: ReadonlyArray<BlockDefinition>;
  presets?: ReadonlyArray<BlockPreset>;
  enabled_on?: SectionEnabledOn;
  disabled_on?: SectionEnabledOn;
  locales?: Readonly<Record<string, Record<string, string>>>;
}
