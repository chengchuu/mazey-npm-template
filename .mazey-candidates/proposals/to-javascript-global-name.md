# Proposal: `toJavaScriptGlobalName`

> Status: implemented in Mazey 5.1.0 and adopted by this project's build tooling. This document is
> retained as the design record.

## Motivation

Build tools often need a legal, deterministic global identifier derived from a package name or
bundle filename. Replacing punctuation is easy, but leading-digit handling and an explicit casing
policy are commonly missed.

## Current Use Case

`scripts/project-config-utils.js:1,22` imports and applies the Rollup IIFE global helper used by
`scripts/rollup.config.mjs`. The scoped-package behavior is indirectly covered by
`test/project-config.test.js:40-47`.

## Proposed API

```ts
export function toJavaScriptGlobalName(value: string): string;
```

Normalized behavior:

```ts
export function toJavaScriptGlobalName(value: string): string {
  if (typeof value !== "string") {
    throw new TypeError("value must be a string");
  }

  const identifier = value.replace(/[^A-Za-z0-9_$]/g, "_").toUpperCase();
  return /^[A-Za-z_$]/.test(identifier) ? identifier : `_${identifier}`;
}
```

The function does not mutate input. Empty input returns `_`. The ASCII policy is intentional: it
produces predictable bundler globals without claiming full ECMAScript Unicode identifier support.

## Implementation Considerations

- Keep uppercase behavior in the name and documentation; do not add a general casing option without
  demonstrated callers.
- Preserve `$` and `_`, prefix leading digits, and avoid collapsing separators unless a future API
  explicitly defines that breaking behavior.
- Throw `TypeError` for non-string runtime input even though TypeScript rejects it statically.

## Compatibility

Universal ES2015-compatible string/regular-expression code. It accesses no browser or Node globals
and is safe to import and call in either runtime.

## Alternatives Considered

- `convertCamelToUnder`: not equivalent; it handles case boundaries, not arbitrary invalid
  identifier characters or leading digits.
- A native API: JavaScript has identifier grammar but no native sanitizer.
- Returning a property key instead: property keys need not be identifiers and solve a different
  problem.

## Test Matrix

| Input                     | Expected              |
| ------------------------- | --------------------- |
| `"my-library"`            | `"MY_LIBRARY"`        |
| `"@scope/my-library"`     | `"_SCOPE_MY_LIBRARY"` |
| `"9patch"`                | `"_9PATCH"`           |
| `"$cache_key"`            | `"$CACHE_KEY"`        |
| `""`                      | `"_"`                 |
| `"a..b"`                  | `"A__B"`              |
| `"工具"`                  | `"__"`                |
| non-string via JavaScript | throws `TypeError`    |

Also assert repeatability and that the original string is unchanged.

## TypeDoc Draft

```ts
/**
 * Convert text to a deterministic uppercase ASCII JavaScript identifier.
 *
 * Characters outside `A-Z`, `a-z`, `0-9`, `_`, and `$` become `_`. A result
 * beginning with a digit is prefixed with `_`; an empty input therefore returns `_`.
 *
 * @param value Text such as a package name or bundle filename.
 * @returns An uppercase identifier suitable for an IIFE global name.
 * @throws TypeError when `value` is not a string.
 * @category String
 */
```

## README Draft

```ts
import { toJavaScriptGlobalName } from "mazey";

toJavaScriptGlobalName("@scope/my-library"); // "_SCOPE_MY_LIBRARY"
```

## Expected Mazey Files

- Source: Mazey's existing `../mazey/src/util.ts` and root export in `../mazey/src/index.ts`.
- Tests: the matching utility test suite with the matrix above.
- Documentation: TypeDoc comment plus the README string-utility section.
