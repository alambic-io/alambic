export type AlpinePluginName = 'intersect' | 'focus' | 'persist' | 'mask' | 'collapse';

export interface TailwindOptions {
  /**
   * Extra content glob patterns appended to the defaults.
   * Patterns are relative to the theme root.
   */
  content?: ReadonlyArray<string>;
}

export interface AlpineOptions {
  /**
   * Alpine plugins to load alongside the core. Phase 1 honors the
   * declaration but the runtime stub loads core only; plugin loading
   * lands in a later iteration.
   */
  plugins?: ReadonlyArray<AlpinePluginName>;
  /**
   * Override the default entry-discovery glob (`sections/* /client.{ts,tsx,js}`).
   */
  entryPattern?: string;
}

export interface TailwindAlpineOptions {
  tailwind?: TailwindOptions;
  alpine?: AlpineOptions;
}
