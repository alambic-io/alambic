/**
 * Map a Shopify setting `type` value to the TypeScript expression that
 * represents its runtime value in Liquid (`section.settings.<id>`).
 *
 * The Shopify object shapes (Product, Image, Article, etc.) are modeled
 * as opaque branded types in `runtime-types.ts`. The LSP (Phase 7) will
 * refine them into full structural types.
 */
import type { InputSetting, SelectOption } from '@alambic/schema';

export function settingTypeExpr(setting: InputSetting): string {
  switch (setting.type) {
    case 'text':
    case 'textarea':
    case 'richtext':
    case 'inline_richtext':
    case 'html':
    case 'liquid':
    case 'color':
    case 'color_background':
      return 'string';

    case 'number':
      return 'number | null';

    case 'checkbox':
      return 'boolean';

    case 'range':
      return 'number';

    case 'select':
    case 'radio':
      return unionOfOptions(setting.options);

    case 'image_picker':
      return 'Shopify.Image | null';
    case 'video':
      return 'Shopify.Video | null';
    case 'video_url':
      return 'Shopify.VideoUrl | null';

    case 'article':
      return 'Shopify.Article | null';
    case 'article_list':
      return 'ReadonlyArray<Shopify.Article>';
    case 'blog':
      return 'Shopify.Blog | null';
    case 'collection':
      return 'Shopify.Collection | null';
    case 'collection_list':
      return 'ReadonlyArray<Shopify.Collection>';
    case 'page':
      return 'Shopify.Page | null';
    case 'product':
      return 'Shopify.Product | null';
    case 'product_list':
      return 'ReadonlyArray<Shopify.Product>';
    case 'link_list':
      return 'Shopify.Linklist | null';
    case 'url':
      return 'string | null';

    case 'metaobject':
      return 'Shopify.Metaobject | null';
    case 'metaobject_list':
      return 'ReadonlyArray<Shopify.Metaobject>';

    case 'color_scheme':
      return 'Shopify.ColorScheme';
    case 'color_scheme_group':
      // color_scheme_group is settings-schema-level only (not used in section settings).
      return 'never';

    case 'font_picker':
      return 'Shopify.Font';

    case 'text_alignment':
      return "'left' | 'center' | 'right'";

    default: {
      // Exhaustiveness check at compile time. If a new setting type is
      // added to `InputSetting`, TS forces a case here.
      const _exhaustive: never = setting;
      void _exhaustive;
      return 'unknown';
    }
  }
}

function unionOfOptions(options: ReadonlyArray<SelectOption>): string {
  if (options.length === 0) return 'string';
  return options.map((o) => JSON.stringify(o.value)).join(' | ');
}
