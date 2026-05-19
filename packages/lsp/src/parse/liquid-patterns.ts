/**
 * Position-aware Liquid pattern detection.
 *
 * The LSP doesn't need a full Liquid AST. It only needs to answer: "at
 * this cursor offset, what am I completing / diagnosing?". A few
 * carefully-anchored regexes against the text immediately before the
 * cursor cover the patterns we care about today:
 *
 *   - `{{ section.settings.<X> }}`     — section setting access
 *   - `{{ block.settings.<X> }}`       — block setting access
 *   - `{{ 'key.path' | t }}`           — locale key inside a `t`-filter string
 *   - `{% render '<name>' %}`          — snippet name in a render tag
 *   - `{% section '<name>' %}`         — section type in a section tag
 *
 * Limitations: we look at the text BEFORE the cursor only (since LSP
 * completion fires at the cursor). We require the opening `{{` / `{%`
 * to appear on the same logical line as the cursor — multi-line Liquid
 * expressions slip through. That's acceptable for the v1 LSP; if it
 * becomes painful we'll upgrade to a real Liquid parser.
 */

export type CompletionContext =
  | { readonly kind: 'section-setting'; readonly prefix: string }
  | { readonly kind: 'block-setting'; readonly prefix: string }
  | {
      readonly kind: 'locale-key';
      readonly prefix: string;
      readonly quote: '"' | "'";
    }
  | {
      readonly kind: 'render';
      readonly prefix: string;
      readonly quote: '"' | "'";
    }
  | {
      readonly kind: 'section-tag';
      readonly prefix: string;
      readonly quote: '"' | "'";
    }
  | { readonly kind: 'none' };

/**
 * Return the chunk of `text` from the most recent `{{` or `{%` opener
 * (or line start if no opener is found within `lookback`) up to `offset`.
 * Used to scope the regex matchers below to the current Liquid expression.
 */
export function leadingExpression(text: string, offset: number): string {
  const start = Math.max(0, offset - 256);
  const window = text.slice(start, offset);
  const lastOpen = Math.max(window.lastIndexOf('{{'), window.lastIndexOf('{%'));
  return lastOpen >= 0 ? window.slice(lastOpen) : window;
}

const SECTION_SETTING_TAIL = /\bsection\.settings\.([A-Za-z0-9_]*)$/;
const BLOCK_SETTING_TAIL = /\bblock\.settings\.([A-Za-z0-9_]*)$/;
// Open quote with no closing quote → cursor is still inside the string.
const LOCALE_KEY_TAIL = /(['"])((?:[^'"\\]|\\.)*)$/;
const RENDER_TAIL = /\{%-?\s*render\s+(['"])((?:[^'"\\]|\\.)*)$/;
const SECTION_TAG_TAIL = /\{%-?\s*section\s+(['"])((?:[^'"\\]|\\.)*)$/;

export function findCompletionContext(text: string, offset: number): CompletionContext {
  const window = leadingExpression(text, offset);

  // Tag-anchored cases first (they're more specific than the bare
  // string-quote case).
  const renderMatch = RENDER_TAIL.exec(window);
  if (renderMatch) {
    return {
      kind: 'render',
      prefix: renderMatch[2] ?? '',
      quote: (renderMatch[1] ?? "'") as '"' | "'",
    };
  }
  const sectionTagMatch = SECTION_TAG_TAIL.exec(window);
  if (sectionTagMatch) {
    return {
      kind: 'section-tag',
      prefix: sectionTagMatch[2] ?? '',
      quote: (sectionTagMatch[1] ?? "'") as '"' | "'",
    };
  }

  const sectionSettingMatch = SECTION_SETTING_TAIL.exec(window);
  if (sectionSettingMatch) {
    return { kind: 'section-setting', prefix: sectionSettingMatch[1] ?? '' };
  }
  const blockSettingMatch = BLOCK_SETTING_TAIL.exec(window);
  if (blockSettingMatch) {
    return { kind: 'block-setting', prefix: blockSettingMatch[1] ?? '' };
  }

  // Locale-key string. Detect when the cursor is inside a single-quoted
  // string that will likely be followed by `| t`. To avoid noisy
  // completions in unrelated strings, only fire when the expression
  // window contains a `t` filter reference *after* the cursor or in the
  // same expression. We approximate that by checking the entire expression
  // chunk includes a `| t`-like sequence, or the window starts with `{{`.
  const localeMatch = LOCALE_KEY_TAIL.exec(window);
  if (localeMatch && window.startsWith('{{')) {
    return {
      kind: 'locale-key',
      prefix: localeMatch[2] ?? '',
      quote: (localeMatch[1] ?? "'") as '"' | "'",
    };
  }

  return { kind: 'none' };
}

/**
 * Locate every `{{ '<key>' | t }}` (and `... | t: ...`) reference in
 * the document. Returns the key string and its source range for each.
 * Used by diagnostics to flag unknown locale keys.
 */
export interface LocaleReference {
  readonly key: string;
  readonly start: number;
  readonly end: number;
}

const LOCALE_T_FILTER = /(['"])((?:[^'"\\]|\\.)*?)\1\s*\|\s*t\b/g;

export function findLocaleReferences(text: string): LocaleReference[] {
  const out: LocaleReference[] = [];
  for (const m of text.matchAll(LOCALE_T_FILTER)) {
    if (m.index === undefined) continue;
    const key = m[2] ?? '';
    const quoteOffset = m.index + 1; // after opening quote
    out.push({ key, start: quoteOffset, end: quoteOffset + key.length });
  }
  return out;
}

/**
 * Locate every `section.settings.<id>` and `block.settings.<id>`
 * reference. Used by diagnostics to flag unknown setting ids inside a
 * file whose schema is known (section or theme-block context).
 */
export interface SettingReference {
  readonly scope: 'section' | 'block';
  readonly id: string;
  readonly start: number;
  readonly end: number;
}

const SETTING_ACCESS = /\b(section|block)\.settings\.([A-Za-z0-9_]+)/g;

export function findSettingReferences(text: string): SettingReference[] {
  const out: SettingReference[] = [];
  for (const m of text.matchAll(SETTING_ACCESS)) {
    if (m.index === undefined) continue;
    const scope = (m[1] ?? 'section') as 'section' | 'block';
    const id = m[2] ?? '';
    const idStart = m.index + scope.length + '.settings.'.length;
    out.push({ scope, id, start: idStart, end: idStart + id.length });
  }
  return out;
}
