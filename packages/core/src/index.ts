export { defineConfig, resolveConfig } from './config/index.js';
export { alambic } from './plugin/index.js';
export { buildStaging, type BuildStagingOptions } from './staging/build.js';
export { watchStaging, type StagingWatcher, type WatchStagingOptions } from './staging/watch.js';
export { mapFile, type MapResult } from './staging/map.js';
export {
  env,
  environmentToCliFlags,
  isEnvRef,
  resolveEnvironment,
  type Environment,
  type EnvRef,
  type EnvValue,
  type ResolvedEnvironment,
} from './env/index.js';
export { applyEnvFiles } from './env/load-env.js';
export { AlambicError, isAlambicError, type AlambicErrorOptions } from './errors/index.js';
export { createLogger, type Logger, type LogLevel } from './logger/index.js';
export {
  createEventBus,
  type EventBus,
  type EventName,
  type EventHandler,
  type AlambicEvents,
  type FileChangedKind,
} from './events/index.js';
export type { AlambicConfig, AlambicPluginOptions, ResolvedAlambicConfig } from './types.js';
