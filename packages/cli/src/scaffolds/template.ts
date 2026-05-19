/**
 * Template for `alambic new template <name>`.
 *
 * Scaffolds a JSON template (Online Store 2.0). We default to JSON over
 * Liquid since 2.0 is the standard — Liquid templates can still be
 * authored by hand when needed.
 *
 * The default body is intentionally minimal: a single empty `sections`
 * map + `order`. The author fills in real section refs after running
 * `alambic new section <name>` for whatever they need.
 */
export const TEMPLATE_JSON = `{
  "sections": {},
  "order": []
}
`;
