# @alambic/hmr

> Section-aware hot module replacement for Shopify themes. Editing a Liquid section swaps that section's DOM in place, preserving state in the rest of the page.

---

## Purpose

Vite's built-in HMR works for JS and CSS, but it can't handle server-rendered Liquid. `@alambic/hmr` fills the gap: when a `.liquid` file changes, it triggers a Section Rendering API fetch and swaps the affected DOM node, leaving everything else untouched.

This is the difference between "edit a section, lose your scroll position and form state" and "edit a section, watch it update without losing context."

## Public API

```ts
export { hmrPlugin } from './plugin';            // Vite plugin contributed to core
export { hmrClient } from './client';            // Browser-side runtime (bundled separately)
export { type HmrEvent, type HmrEventKind } from './protocol';
```

`hmrPlugin` is included by `@alambic/core` automatically. End users don't import it directly.

`hmrClient` is the path to the built browser runtime, injected into the dev preview's `<head>` by `@alambic/core`.

## Protocol

Defined in `src/protocol.ts`. Stable across minor versions.

```ts
export type HmrEvent =
  | { kind: 'section-update'; handle: string; templateContext: string }
  | { kind: 'settings-update' }
  | { kind: 'locale-update' }
  | { kind: 'fallback-reload'; reason: string };
```

Events are sent from the dev server to the browser over Vite's existing WebSocket as custom events (`vite:custom`). The browser client subscribes and reacts.

## How a section update happens

```
1. User saves sections/x/index.liquid
2. Vite's file watcher fires
3. @alambic/core sees the change, calls @alambic/hmr
4. @alambic/hmr:
   a. Asks @alambic/core to push the file to the Shopify dev theme
      via the spawned `shopify theme dev` subprocess
   b. Waits for the CLI's "file synced" event
   c. Emits {kind: 'section-update', handle: 'x', templateContext: '/products/foo'}
5. Browser client receives event
6. Browser client:
   a. Fetches `https://<preview>?sections=x` (Section Rendering API)
   b. Parses response: {x: '<div>...</div>'}
   c. Locates `<div data-section-id="x">` in current DOM
   d. Swaps innerHTML (preserving the wrapper)
   e. Notifies the JS adapter to re-hydrate islands inside the new HTML
7. Done. Total time: ~300-500ms warm.
```

## Failure modes

Every step can fail. The HMR layer is defensive: any failure falls back to a full page reload with an actionable console message.

| Failure | Behavior |
|---|---|
| Shopify CLI push timed out (>5s) | Full reload. Log: "Shopify CLI did not acknowledge push" |
| Section Rendering API returned non-200 | Full reload. Log: "Section Rendering API error: <status>" |
| DOM target node not found | Full reload. Log: "Section <handle> not present on current page" |
| Hydration runtime threw | Full reload. Log: "Hydration error after section swap" |

All failures are logged with `ALAMBIC_LOG=debug` for full detail including stack traces.

## Internal modules

```
src/
├── index.ts
├── plugin.ts                  # Vite plugin (server-side)
├── client/
│   ├── index.ts               # Entry for browser bundle
│   ├── socket.ts              # vite:custom event subscription
│   ├── section-swap.ts        # DOM swap logic
│   └── rehydrate.ts           # Talk to JS adapter to re-hydrate
├── protocol.ts                # HmrEvent types
├── server/
│   ├── shopify-push.ts        # Drive the CLI subprocess push
│   ├── section-fetch.ts       # Server-side Section Rendering API helper (for tests)
│   └── emit.ts                # Send HmrEvent over Vite WS
└── internal/
    └── timeouts.ts
```

The browser bundle is built as a separate `vp pack` entry (`entry: { client: 'src/client/index.ts' }`, ESM, no splitting). It must be smaller than 4 KB gzipped — there's a CI check.

## Dependencies

- `@alambic/core` — uses the logger, the event bus, and the Vite plugin contribution mechanism.

## Testing

- Unit tests for the protocol (every event kind round-trips through serialization).
- Unit tests for `section-swap` against jsdom fixtures.
- Integration test in `test/integration/section-update.test.ts` boots a real dev server, edits a section file, asserts the HMR event is emitted and the swap completes.
- Browser-bundle size assertion in CI: `dist/client/index.js` must be ≤ 4 KB gzipped.

## Debugging

1. Set `ALAMBIC_LOG=debug`.
2. Reproduce the issue.
3. Check the logs for which step failed: push, fetch, swap, or rehydrate.
4. The HMR event flow is fully traced in debug mode with timing for each step.

If the issue is intermittent, check `src/internal/timeouts.ts` — Shopify CLI push timing is variable and our default timeout may be too aggressive.

## Claude Code notes

- The protocol file is the contract. Changes to `HmrEvent` are breaking changes — major bump.
- The browser bundle has a strict size budget. Adding a dependency here usually means rewriting it inline.
- When adding a new event kind, add it to the union in `protocol.ts`, add a server-side emit helper, add a client-side handler, and write a round-trip test.
- Test setup for HMR is expensive — it boots a real Vite dev server. Use the `@alambic/test-utils` `createHmrTestHarness` helper, which reuses a single instance across tests in a file.
