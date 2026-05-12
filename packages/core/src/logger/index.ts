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
