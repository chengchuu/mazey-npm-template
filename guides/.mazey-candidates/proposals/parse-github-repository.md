# Proposal: `parseGitHubRepository`

> Status: implemented in Mazey 5.1.0 and adopted through this project's package-metadata adapter.
> This document is retained as the design record.

## Motivation

Package metadata, release scripts, and CLIs encounter GitHub repositories as shorthand, SCP-like
SSH syntax, or several URL schemes. A focused parser avoids repeated, inconsistent string slicing
while providing a canonical identity object.

## Current Use Case

`scripts/project-config-utils.js:27-37` normalizes `package.json#repository` for site, release, and
documentation URLs. Accepted transport forms and invalid-host behavior are covered by
`test/project-config.test.js:62-82`.

## Proposed API

```ts
export interface GitHubRepositoryDetails {
  owner: string;
  name: string;
  slug: string;
  url: string;
}

export function parseGitHubRepository(value: string): GitHubRepositoryDetails;
```

The normalized core should accept only a string. An npm-metadata adapter may read `{ url }` before
calling it, but that policy should not expand the public parser signature.

Implementation requirements:

- trim surrounding whitespace;
- accept `github:owner/name`, `owner/name`, `git@github.com:owner/name.git`, and GitHub URLs using
  `git`, `ssh`, `http`, or `https`, optionally prefixed by `git+`;
- normalize `www.github.com` and hostname case;
- remove one terminal `.git` suffix;
- require exactly two decoded path components;
- reject credentials other than the transport's conventional `git` user, ports, query strings,
  fragments, empty components, dot segments, and non-GitHub hosts;
- return a newly allocated object and never mutate input.

## Implementation Considerations

Use the WHATWG `URL` API for URL forms and a small explicit expression for shorthand/SCP forms.
Validation should occur after normalization. Errors should be `TypeError` for non-string input and
`Error` (or one documented subclass) for unsupported repository syntax.

Do not silently percent-decode ambiguous `/`, `\\`, NUL, dot segments, or control characters. Owner
and repository grammar should follow GitHub's documented accepted syntax or deliberately use a
strict subset.

## Compatibility

Universal in Mazey's supported browsers and Node versions where `URL` is available. It performs no
network access and does not depend on Git, GitHub availability, filesystem paths, or browser globals.

## Alternatives Considered

- Mazey `isValidHttpUrl`: validates some URLs but does not understand Git transports, shorthands,
  owner/name extraction, or canonical GitHub identity.
- npm package normalization libraries: broader metadata behavior would add a dependency and policy
  surface for a small parser.
- `new URL` alone: cannot parse `github:` shorthand or SCP syntax into the required identity.

## Test Matrix

| Category           | Cases                                                                            |
| ------------------ | -------------------------------------------------------------------------------- |
| Shorthand          | `owner/name`, `github:owner/name`, optional `.git`                               |
| SSH/SCP            | `git@github.com:owner/name.git`, `ssh://git@github.com/owner/name.git`           |
| Git/HTTP           | `git://`, `git+ssh://`, `http://`, `https://`, `git+https://`                    |
| Host normalization | uppercase host, `www.github.com`                                                 |
| Invalid values     | empty, whitespace, non-string, missing component, three path parts, other host   |
| URL policy         | credentials, port, query, fragment, dot segments, percent-encoded separators/NUL |
| Text boundaries    | Unicode owner/name according to chosen grammar                                   |
| Stability          | repeated calls produce equal new objects; input is not mutated                   |

Scoped npm names belong in adapter tests, confirming that package scope is unrelated to repository
owner parsing.

## TypeDoc Draft

```ts
/**
 * Parse a GitHub repository shorthand or transport URL.
 *
 * @param value A GitHub `owner/name` shorthand, SCP form, or supported Git URL.
 * @returns Canonical owner, repository name, slug, and HTTPS URL.
 * @throws TypeError when `value` is not a string.
 * @throws Error when the value is malformed or does not identify one GitHub repository.
 * @category URL
 */
```

## README Draft

```ts
import { parseGitHubRepository } from "mazey";

parseGitHubRepository("git@github.com:acme/widget.git");
// { owner: "acme", name: "widget", slug: "acme/widget", url: "https://github.com/acme/widget" }
```

## Expected Mazey Files

- Source: Mazey's existing `../mazey/src/url.ts`, types, and root export in
  `../mazey/src/index.ts`.
- Tests: URL utility tests using only local deterministic strings.
- Documentation: TypeDoc comment and README URL/developer-tool section.
