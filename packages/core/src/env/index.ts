/**
 * Environment variable references and per-environment configuration.
 *
 * `env('NAME')` returns a tagged sentinel. The sentinel is resolved
 * against `process.env` at config-resolution time, AFTER env files have
 * been loaded by `applyEnvFiles`.
 *
 * This indirection lets users write `store: env('SHOPIFY_DEV_STORE')`
 * even though `process.env.SHOPIFY_DEV_STORE` hasn't been populated yet
 * when `alambic.config.ts` is first imported.
 */

const ENV_REF_TAG = Symbol.for('@alambic/core/env-ref');

export interface EnvRef {
  readonly [ENV_REF_TAG]: true;
  readonly name: string;
  readonly defaultValue: string | undefined;
}

export function env(name: string, defaultValue?: string): EnvRef {
  return {
    [ENV_REF_TAG]: true,
    name,
    defaultValue,
  };
}

export function isEnvRef(value: unknown): value is EnvRef {
  return typeof value === 'object' && value !== null && ENV_REF_TAG in value;
}

/** A configuration value that may be either a literal or an `env()` reference. */
export type EnvValue = string | EnvRef;

/**
 * A target Shopify store + theme. Used by `alambic dev` and (future) push.
 *
 * For API authentication, Alambic relies on the Shopify CLI's OAuth session
 * (`shopify auth login`). If you need a Theme Access token instead, pass
 * `--password <shptka_…>` via `dev.shopifyCliArgs` — it's intentionally
 * not a first-class environment field.
 */
export interface Environment {
  /** Shopify store domain, e.g. `mystore.myshopify.com`. */
  store?: EnvValue;
  /** Numeric theme ID. Omit to let the Shopify CLI use the hidden dev theme. */
  themeId?: EnvValue;
  /** Storefront password (the public "Coming Soon" page) for password-protected dev stores. */
  storePassword?: EnvValue;
  /** Pass-through `--environment` value for `shopify.theme.toml` users. */
  shopifyEnvironment?: EnvValue;
}

export interface ResolvedEnvironment {
  store: string | undefined;
  themeId: string | undefined;
  storePassword: string | undefined;
  shopifyEnvironment: string | undefined;
}

export function resolveEnvironment(env: Environment | undefined): ResolvedEnvironment {
  return {
    store: resolveValue(env?.store),
    themeId: resolveValue(env?.themeId),
    storePassword: resolveValue(env?.storePassword),
    shopifyEnvironment: resolveValue(env?.shopifyEnvironment),
  };
}

function resolveValue(v: EnvValue | undefined): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'string') return v;
  // sentinel
  const fromEnv = process.env[v.name];
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  return v.defaultValue;
}

/**
 * Translate a resolved environment into Shopify CLI flag pairs that can
 * be appended to `shopify theme dev/push`.
 */
export function environmentToCliFlags(env: ResolvedEnvironment): string[] {
  const out: string[] = [];
  if (env.shopifyEnvironment) out.push('--environment', env.shopifyEnvironment);
  if (env.store) out.push('--store', env.store);
  if (env.themeId) out.push('--theme', env.themeId);
  if (env.storePassword) out.push('--store-password', env.storePassword);
  return out;
}
