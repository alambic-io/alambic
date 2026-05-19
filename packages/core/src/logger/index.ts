import { type ConsolaInstance, createConsola } from 'consola';

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

export interface Logger {
  readonly namespace: string;
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  withTag(child: string): Logger;
}

const levelMap: Record<LogLevel, number> = {
  silent: -1,
  error: 0,
  warn: 1,
  info: 3,
  debug: 4,
};

function resolveLevel(): number {
  const raw = process.env['ALAMBIC_LOG']?.toLowerCase();
  if (raw && raw in levelMap) {
    return levelMap[raw as LogLevel];
  }
  return levelMap.info;
}

const root: ConsolaInstance = createConsola({
  level: resolveLevel(),
  formatOptions: { colors: true, date: false, compact: true },
});

/**
 * Override the root log level at runtime. Useful for the CLI's
 * `--verbose` / `--quiet` flags — they're parsed after this module has
 * been imported, so the constructor-time `resolveLevel()` is too early.
 *
 * Pass `'silent'` to drop everything, `'error'` for `--quiet`, `'debug'`
 * for `--verbose`. The change applies to loggers created after the call;
 * loggers created earlier (e.g. inside `@alambic/core`'s plugin) inherit
 * via consola's tag chain.
 */
export function setLogLevel(level: LogLevel): void {
  if (level in levelMap) {
    root.level = levelMap[level];
  }
}

/**
 * Disable ANSI colors. Useful for `--no-color` CI environments. Maps to
 * the standard `NO_COLOR` env convention so downstream tools (commander,
 * consola, chalk) also respect it.
 */
export function setNoColor(): void {
  root.options.formatOptions.colors = false;
  process.env['NO_COLOR'] = '1';
  process.env['FORCE_COLOR'] = '0';
}

export function createLogger(namespace: string): Logger {
  const tagged = root.withTag(namespace);
  return wrap(namespace, tagged);
}

function wrap(namespace: string, instance: ConsolaInstance): Logger {
  // Consola types are intentionally narrow; forward our `unknown[]` payload
  // by casting at the boundary. The logger contract accepts anything.
  const forward =
    (fn: (...a: never[]) => void) =>
    (...args: unknown[]) =>
      fn(...(args as never[]));

  return {
    namespace,
    error: forward(instance.error.bind(instance)),
    warn: forward(instance.warn.bind(instance)),
    info: forward(instance.info.bind(instance)),
    debug: forward(instance.debug.bind(instance)),
    withTag: (child) => {
      const fullName = `${namespace}:${child}`;
      return wrap(fullName, instance.withTag(child));
    },
  };
}
