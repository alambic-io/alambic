/**
 * Shared types consumed by every adapter and by @alambic/core.
 *
 * These are intentionally minimal in Phase 1. `CompiledSection` and
 * `ThemeSettings` will be tightened as `@alambic/schema` and
 * `@alambic/types` come online in Phase 2.
 */

export interface Logger {
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

export interface EntryPoint {
  /** Logical name (e.g. `sections/product-card/client`). Stable across rebuilds. */
  readonly id: string;
  /** Absolute filesystem path to the source entry. */
  readonly file: string;
  /**
   * Optional grouping. Sections share `kind: 'section'`; layout-level entries
   * may use `kind: 'layout'`. Adapters can introduce their own kinds.
   */
  readonly kind?: string;
}

/**
 * Phase 1 placeholder. Will gain `settings`, `blocks`, and a typed schema
 * reference when `@alambic/schema` lands in Phase 2.
 */
export interface CompiledSection {
  readonly handle: string;
  readonly sourcePath: string;
  readonly clientEntry?: string;
}

/**
 * Phase 1 placeholder. Will gain typed accessors once `@alambic/types`
 * generates settings types from `config/settings_schema.json`.
 */
export type ThemeSettings = Readonly<Record<string, unknown>>;

export interface AdapterContext {
  readonly mode: 'dev' | 'build';
  readonly themeRoot: string;
  readonly outputRoot: string;
  readonly sections: ReadonlyArray<CompiledSection>;
  readonly settings: ThemeSettings;
  readonly logger: Logger;
}
