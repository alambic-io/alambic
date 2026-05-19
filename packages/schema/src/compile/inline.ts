/**
 * Inject (or replace) a `{% schema %}…{% endschema %}` block inside a
 * Liquid file.
 *
 * Strategy:
 *   - Scan for the FIRST `{% schema %}` block, ignoring occurrences
 *     inside `{% comment %} … {% endcomment %}` and `{% raw %} … {% endraw %}`
 *     blocks.
 *   - If found, replace the entire `{% schema %}…{% endschema %}` span
 *     (whitespace markers permitted: `{%-` / `-%}`).
 *   - If not found, append the schema block at the end of the file,
 *     separated by a blank line.
 *
 * The inliner is intentionally NOT a full Liquid parser; we recognize the
 * three Liquid escape contexts that could otherwise produce false matches
 * (comment / raw / nested schema). Anything else is treated as inert text.
 */

const SCHEMA_OPEN = /\{%[-]?\s*schema\s*[-]?%\}/;
const SCHEMA_CLOSE = /\{%[-]?\s*endschema\s*[-]?%\}/;
const COMMENT_OPEN = /\{%[-]?\s*comment\s*[-]?%\}/;
const COMMENT_CLOSE = /\{%[-]?\s*endcomment\s*[-]?%\}/;
const RAW_OPEN = /\{%[-]?\s*raw\s*[-]?%\}/;
const RAW_CLOSE = /\{%[-]?\s*endraw\s*[-]?%\}/;

interface SchemaSpan {
  start: number;
  end: number;
}

/**
 * Find the `{% schema %}…{% endschema %}` span (start..end indices,
 * end-exclusive) ignoring occurrences inside `comment` or `raw` blocks.
 * Returns null if no schema block exists.
 */
export function findSchemaSpan(source: string): SchemaSpan | null {
  let i = 0;
  while (i < source.length) {
    const tail = source.slice(i);

    // Skip over comment/raw escape contexts so we never match a `schema`
    // tag living inside them.
    const cm = COMMENT_OPEN.exec(tail);
    const rm = RAW_OPEN.exec(tail);
    const sm = SCHEMA_OPEN.exec(tail);

    const nearest = pickNearest([
      cm ? { kind: 'comment' as const, index: cm.index, length: cm[0].length } : null,
      rm ? { kind: 'raw' as const, index: rm.index, length: rm[0].length } : null,
      sm ? { kind: 'schema' as const, index: sm.index, length: sm[0].length } : null,
    ]);
    if (!nearest) return null;

    const absStart = i + nearest.index;
    if (nearest.kind === 'comment') {
      const after = source.slice(absStart + nearest.length);
      const close = COMMENT_CLOSE.exec(after);
      if (!close) return null; // unclosed comment — bail
      i = absStart + nearest.length + close.index + close[0].length;
      continue;
    }
    if (nearest.kind === 'raw') {
      const after = source.slice(absStart + nearest.length);
      const close = RAW_CLOSE.exec(after);
      if (!close) return null;
      i = absStart + nearest.length + close.index + close[0].length;
      continue;
    }
    // schema
    const after = source.slice(absStart + nearest.length);
    const close = SCHEMA_CLOSE.exec(after);
    if (!close) {
      throw new Error('Found `{% schema %}` without a matching `{% endschema %}`.');
    }
    return {
      start: absStart,
      end: absStart + nearest.length + close.index + close[0].length,
    };
  }
  return null;
}

function pickNearest<T extends { index: number }>(items: ReadonlyArray<T | null>): T | null {
  let best: T | null = null;
  for (const item of items) {
    if (!item) continue;
    if (best === null || item.index < best.index) best = item;
  }
  return best;
}

export interface InlineOptions {
  /** Pre-stringified JSON (with trailing newline) to inline. */
  body: string;
  /**
   * When inserting a brand-new block, choose how it's separated from
   * preceding content. Default: `'\n\n'`.
   */
  separator?: string;
}

/**
 * Replace (or insert) a `{% schema %}` block in the source.
 */
export function inlineSchema(source: string, options: InlineOptions): string {
  const block = `{% schema %}\n${options.body.replace(/\n$/, '')}\n{% endschema %}`;
  const span = findSchemaSpan(source);
  if (span) {
    return source.slice(0, span.start) + block + source.slice(span.end);
  }
  const sep = options.separator ?? '\n\n';
  const trimmed = source.replace(/\s+$/, '');
  return `${trimmed}${sep}${block}\n`;
}
