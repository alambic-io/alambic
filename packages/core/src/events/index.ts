/**
 * Typed event bus used by core to communicate lifecycle events to other
 * Alambic packages without coupling them at the type level.
 */

export type FileChangedKind = 'liquid' | 'ts' | 'css' | 'config' | 'locale' | 'template';

export interface AlambicEvents {
  'dev:start': { themeRoot: string };
  'dev:ready': { vitePort: number; shopifyPort: number | null };
  'dev:shutdown': { reason: string };
  'file:changed': { path: string; kind: FileChangedKind };
  'theme:pushed': { file: string };
  'build:start': { themeRoot: string; outputRoot: string };
  'build:emit': { file: string };
  'build:done': { outputRoot: string; durationMs: number };
}

export type EventName = keyof AlambicEvents;
export type EventHandler<E extends EventName> = (payload: AlambicEvents[E]) => void | Promise<void>;

export interface EventBus {
  on<E extends EventName>(event: E, handler: EventHandler<E>): () => void;
  emit<E extends EventName>(event: E, payload: AlambicEvents[E]): Promise<void>;
  off<E extends EventName>(event: E, handler: EventHandler<E>): void;
}

export function createEventBus(): EventBus {
  const handlers = new Map<EventName, Set<EventHandler<EventName>>>();

  return {
    on(event, handler) {
      const set = handlers.get(event) ?? new Set();
      set.add(handler as EventHandler<EventName>);
      handlers.set(event, set);
      return () => {
        set.delete(handler as EventHandler<EventName>);
      };
    },
    off(event, handler) {
      handlers.get(event)?.delete(handler as EventHandler<EventName>);
    },
    async emit(event, payload) {
      const set = handlers.get(event);
      if (!set) return;
      // Snapshot before iterating so off()/on() inside handlers don't disturb the loop.
      const snapshot = [...set];
      for (const handler of snapshot) {
        await handler(payload);
      }
    },
  };
}
