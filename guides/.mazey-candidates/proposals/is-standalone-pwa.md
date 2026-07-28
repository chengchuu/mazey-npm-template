# Proposal: `isStandalonePWA`

> Status: implemented in Mazey 5.1.0. The project retains its injected local adapter for deterministic
> browser tests; this document is retained as the design record.

## Motivation

Websites commonly need to hide install instructions or adjust UI when displayed as a standalone PWA.
The standard media query does not cover older/current iOS Safari behavior represented by
`navigator.standalone`, and the check is distinct from PWA prerequisite detection.

## Current Use Case

`site/pwa.ts:52-60` controls install UI for standard standalone display mode and the iOS fallback.
The behavior is called from the install lifecycle and covered by `test/pwa.test.js:130-157`.

## Proposed API

```ts
export function isStandalonePWA(): boolean;
```

Normalized implementation shape:

```ts
export function isStandalonePWA(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const appleNavigator = navigator as Navigator & { standalone?: boolean };

  try {
    return (
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(display-mode: standalone)").matches) ||
      appleNavigator.standalone === true
    );
  } catch {
    return appleNavigator.standalone === true;
  }
}
```

The function returns a boolean, performs no writes, registers no listeners, and never throws for a
missing or hostile browser host object.

## Implementation Considerations

- Keep the name PWA-specific to avoid confusing this with the Fullscreen API or standalone browser
  windows.
- Do not infer installation, service-worker control, prompt availability, or secure origin.
- Host-object injection may remain an internal helper for unit tests, but the public API should match
  Mazey's existing zero-argument browser detectors.

## Compatibility

Browser-preferred and import-safe in Node.js/SSR. It returns `false` outside a browser. The iOS
property is a nonstandard compatibility signal and must be typed locally without globally widening
`Navigator` for consumers.

## Alternatives Considered

- `isSafePWAEnv`: checks secure context, Service Worker support, and a manifest link. It answers a
  different question and may be true in an ordinary tab or false for an already launched app with
  unusual document markup.
- Standard `matchMedia` only: misses the iOS fallback the current project needs.
- A generic display-mode API: more surface and return semantics than the demonstrated use case.

## Test Matrix

| Environment                     | Expected                                        |
| ------------------------------- | ----------------------------------------------- |
| No `window`/`navigator`         | `false`                                         |
| `matchMedia` absent             | iOS flag result                                 |
| Standard query matches          | `true`                                          |
| Standard query does not match   | iOS flag result                                 |
| `navigator.standalone === true` | `true`                                          |
| missing/false iOS property      | `false` unless media query matches              |
| `matchMedia` throws             | iOS flag result                                 |
| repeated invocation             | stable result, no listeners or global mutations |

## TypeDoc Draft

```ts
/**
 * Detect whether the current page is displayed as a standalone PWA.
 *
 * Checks the standard `display-mode: standalone` media query and the iOS Safari
 * `navigator.standalone` compatibility signal. This does not prove that the app is
 * installed, trusted, or controlled by a service worker.
 *
 * @returns `true` in detected standalone presentation; otherwise `false`.
 * @category Browser Information
 */
```

## README Draft

```ts
import { isStandalonePWA } from "mazey";

if (isStandalonePWA()) {
  document.querySelector("[data-install-help]")?.remove();
}
```

## Expected Mazey Files

- Source: `../mazey/src/browser.ts` and the root export in `../mazey/src/index.ts`.
- Tests: browser tests for both detection paths plus a Node import/call test.
- Documentation: TypeDoc comment and the README browser/PWA section.
