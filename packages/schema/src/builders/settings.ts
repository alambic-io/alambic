/**
 * Builder functions for every Shopify schema setting type.
 *
 * Each builder is an identity-with-types helper: it returns its input
 * with a `kind: 'setting'` discriminator, so the compiler can walk a
 * section definition without ambiguity.
 *
 * The `type` field is hard-coded inside each builder so consumers never
 * have to spell it out. They write `text({ id, label })`, not
 * `{ type: 'text', id, label }`.
 */
import type {
  ArticleListSetting,
  ArticleSetting,
  BlogSetting,
  CheckboxSetting,
  CollectionListSetting,
  CollectionSetting,
  ColorBackgroundSetting,
  ColorSchemeGroupSetting,
  ColorSchemeSetting,
  ColorSetting,
  FontPickerSetting,
  HeaderSetting,
  HtmlSetting,
  ImagePickerSetting,
  InlineRichtextSetting,
  LinkListSetting,
  LiquidSetting,
  MetaobjectListSetting,
  MetaobjectSetting,
  NumberSetting,
  PageSetting,
  ParagraphSetting,
  ProductListSetting,
  ProductSetting,
  RadioSetting,
  RangeSetting,
  RichtextSetting,
  SelectSetting,
  TextAlignmentSetting,
  TextSetting,
  TextareaSetting,
  UrlSetting,
  VideoSetting,
  VideoUrlSetting,
} from '../types.js';

type Without<T, K extends string> = Omit<T, K | 'kind' | 'type'>;

const make =
  <T extends string>(type: T) =>
  <Args extends object>(args: Args): Args & { kind: 'setting'; type: T } => ({
    kind: 'setting',
    type,
    ...args,
  });

/* ─── Basic ─────────────────────────────────────────────────────────── */

export const text = (args: Without<TextSetting, never>): TextSetting => make('text')(args);
export const textarea = (args: Without<TextareaSetting, never>): TextareaSetting =>
  make('textarea')(args);
export const number = (args: Without<NumberSetting, never>): NumberSetting => make('number')(args);
export const checkbox = (args: Without<CheckboxSetting, never>): CheckboxSetting =>
  make('checkbox')(args);
export const range = (args: Without<RangeSetting, never>): RangeSetting => make('range')(args);
export const select = (args: Without<SelectSetting, never>): SelectSetting => make('select')(args);
export const radio = (args: Without<RadioSetting, never>): RadioSetting => make('radio')(args);

/* ─── Rich text ─────────────────────────────────────────────────────── */

export const richtext = (args: Without<RichtextSetting, never>): RichtextSetting =>
  make('richtext')(args);
export const inline_richtext = (
  args: Without<InlineRichtextSetting, never>,
): InlineRichtextSetting => make('inline_richtext')(args);
export const html = (args: Without<HtmlSetting, never>): HtmlSetting => make('html')(args);
export const liquid = (args: Without<LiquidSetting, never>): LiquidSetting => make('liquid')(args);

/* ─── Media ─────────────────────────────────────────────────────────── */

export const image_picker = (args: Without<ImagePickerSetting, never>): ImagePickerSetting =>
  make('image_picker')(args);
export const video = (args: Without<VideoSetting, never>): VideoSetting => make('video')(args);
export const video_url = (args: Without<VideoUrlSetting, never>): VideoUrlSetting =>
  make('video_url')(args);

/* ─── Resource pickers ──────────────────────────────────────────────── */

export const article = (args: Without<ArticleSetting, never>): ArticleSetting =>
  make('article')(args);
export const article_list = (args: Without<ArticleListSetting, never>): ArticleListSetting =>
  make('article_list')(args);
export const blog = (args: Without<BlogSetting, never>): BlogSetting => make('blog')(args);
export const collection = (args: Without<CollectionSetting, never>): CollectionSetting =>
  make('collection')(args);
export const collection_list = (
  args: Without<CollectionListSetting, never>,
): CollectionListSetting => make('collection_list')(args);
export const page = (args: Without<PageSetting, never>): PageSetting => make('page')(args);
export const product = (args: Without<ProductSetting, never>): ProductSetting =>
  make('product')(args);
export const product_list = (args: Without<ProductListSetting, never>): ProductListSetting =>
  make('product_list')(args);
export const link_list = (args: Without<LinkListSetting, never>): LinkListSetting =>
  make('link_list')(args);
export const url = (args: Without<UrlSetting, never>): UrlSetting => make('url')(args);
export const metaobject = (args: Without<MetaobjectSetting, never>): MetaobjectSetting =>
  make('metaobject')(args);
export const metaobject_list = (
  args: Without<MetaobjectListSetting, never>,
): MetaobjectListSetting => make('metaobject_list')(args);

/* ─── Color ─────────────────────────────────────────────────────────── */

export const color = (args: Without<ColorSetting, never>): ColorSetting => make('color')(args);
export const color_background = (
  args: Without<ColorBackgroundSetting, never>,
): ColorBackgroundSetting => make('color_background')(args);
export const color_scheme = (args: Without<ColorSchemeSetting, never>): ColorSchemeSetting =>
  make('color_scheme')(args);
export const color_scheme_group = (
  args: Without<ColorSchemeGroupSetting, never>,
): ColorSchemeGroupSetting => make('color_scheme_group')(args);

/* ─── Typography ────────────────────────────────────────────────────── */

export const font_picker = (args: Without<FontPickerSetting, never>): FontPickerSetting =>
  make('font_picker')(args);

/* ─── Other ─────────────────────────────────────────────────────────── */

export const text_alignment = (args: Without<TextAlignmentSetting, never>): TextAlignmentSetting =>
  make('text_alignment')(args);

export const header = (args: Without<HeaderSetting, never>): HeaderSetting => make('header')(args);

export const paragraph = (args: Without<ParagraphSetting, never>): ParagraphSetting =>
  make('paragraph')(args);
