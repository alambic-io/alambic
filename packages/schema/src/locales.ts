/**
 * Discover and parse `locales/*.json` files in a theme.
 *
 * Shopify themes use nested JSON dictionaries: `general.search.placeholder`
 * resolves to `locales/en.default.json` → `{"general":{"search":{"placeholder":"..."}}}`.
 * Liquid references those via the `t` filter: `{{ 'general.search.placeholder' | t }}`.
 *
 * We flatten the nested objects into dotted keys so consumers (LSP
 * completion, type generation, theme-check-style diagnostics) can deal
 * with one flat key set.
 *
 * What gets flagged as the default locale:
 *   - The file matching `<name>.default.json` (Shopify's marker).
 *   - Fallback: `en.default.json` if multiple `.default.json` files exist.
 *   - Fallback: the first `<name>.json` alphabetically if no `.default` exists.
 *
 * Schema locales (`locales/<name>.schema.json`) are read separately — they
 * back `{% schema %}` translations (setting labels, etc.), not storefront
 * Liquid. The LSP would surface these in schema authoring contexts.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface LocaleEntry {
  /** Locale identifier without extension (e.g. `en`, `fr-CA`). */
  readonly locale: string;
  /** Whether this file is the storefront default (`.default.json`). */
  readonly isDefault: boolean;
  /** Whether this file is the schema locale (`.schema.json`). */
  readonly isSchema: boolean;
  /** Absolute path. */
  readonly filePath: string;
  /** Flattened key → value map (dotted keys). */
  readonly keys: Readonly<Record<string, string>>;
}

export interface LoadedLocales {
  /** Every locale file found, in alphabetical order by locale name. */
  readonly entries: ReadonlyArray<LocaleEntry>;
  /** The storefront default locale entry, if one exists. */
  readonly defaultLocale: LocaleEntry | null;
  /** Union of all storefront keys (across locales). */
  readonly allKeys: ReadonlyArray<string>;
  /** Union of all schema-locale keys. */
  readonly allSchemaKeys: ReadonlyArray<string>;
}

export interface LoadLocalesOptions {
  /** Author's theme root. We read `<themeRoot>/locales/*.json`. */
  readonly themeRoot: string;
}

export async function loadLocales(opts: LoadLocalesOptions): Promise<LoadedLocales> {
  const dir = join(opts.themeRoot, 'locales');
  const fileNames = await safeReaddir(dir);

  const entries: LocaleEntry[] = [];
  for (const name of fileNames) {
    if (!name.endsWith('.json') || name.startsWith('.')) continue;
    const stripped = name.slice(0, -'.json'.length);
    const isDefault = stripped.endsWith('.default');
    const isSchema = stripped.endsWith('.schema');
    if (isDefault && isSchema) continue; // not a valid Shopify combo
    const locale = stripped.replace(/\.default$/, '').replace(/\.schema$/, '');
    const filePath = join(dir, name);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(filePath, 'utf8'));
    } catch (err) {
      throw new Error(`Failed to parse locale ${filePath}: ${(err as Error).message}`);
    }
    const keys = flatten(parsed);
    entries.push({ locale, isDefault, isSchema, filePath, keys });
  }

  entries.sort((a, b) => a.locale.localeCompare(b.locale));

  // Pick the storefront default. Prefer the `<lang>.default.json` Shopify
  // marker; fall back to `en.default` if there are multiple defaults
  // (shouldn't happen in a well-formed theme but is forgiving in the wild).
  const defaults = entries.filter((e) => e.isDefault && !e.isSchema);
  const defaultLocale = defaults.find((e) => e.locale === 'en') ?? defaults[0] ?? null;

  const allKeys = uniqueSorted(
    entries.filter((e) => !e.isSchema).flatMap((e) => Object.keys(e.keys)),
  );
  const allSchemaKeys = uniqueSorted(
    entries.filter((e) => e.isSchema).flatMap((e) => Object.keys(e.keys)),
  );

  return { entries, defaultLocale, allKeys, allSchemaKeys };
}

/**
 * Flatten a nested JSON object into dotted keys. Arrays are stringified
 * (Shopify's `t` filter doesn't traverse them); non-string leaves are
 * coerced to strings so the type stays simple.
 */
export function flatten(value: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (value === null || value === undefined) return out;
  if (typeof value !== 'object') {
    // Primitive leaf (string | number | boolean | bigint | symbol). Coerce
    // explicitly with the known-safe branches to keep tsgolint happy
    // about Object's default stringification.
    if (prefix) {
      if (typeof value === 'string') out[prefix] = value;
      else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
        out[prefix] = value.toString();
      else if (typeof value === 'symbol') out[prefix] = value.description ?? '';
    }
    return out;
  }
  if (Array.isArray(value)) {
    if (prefix) out[prefix] = JSON.stringify(value);
    return out;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const nextKey = prefix ? `${prefix}.${k}` : k;
    Object.assign(out, flatten(v, nextKey));
  }
  return out;
}

function uniqueSorted(xs: ReadonlyArray<string>): string[] {
  return [...new Set(xs)].sort();
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}
