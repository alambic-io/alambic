/**
 * Replace `{{KEY}}` tokens in a string with their variable values.
 * Unknown tokens pass through untouched (so generated files keep working
 * even if a variable was missed).
 */
export function substitute(input: string, vars: Readonly<Record<string, string>>): string {
  return input.replaceAll(/\{\{([A-Z][A-Z0-9_]*)\}\}/g, (match, key: string) => {
    return Object.hasOwn(vars, key) ? (vars[key] ?? match) : match;
  });
}
