# Mazey Candidate Audit

This directory records an audit of reusable utility logic in `mazey-npm-template`. The audit was
performed to distinguish stable cross-project helpers from template policy, browser UI behavior,
test fixtures, native operations, and implementations that are too fragile for a public API.

## Selection Method

The review covered authored source, scripts, configuration, examples, tests, declarations, HTML
templates, package metadata, and contributor documentation. Generated output and dependencies were
excluded. Each helper was checked for callers, tests, runtime requirements, mutation, side effects,
edge cases, provenance, and behavioral overlap with the installed Mazey 5.1.0 public API.

## Completion Update

Mazey 5.1.0 now provides `toJavaScriptGlobalName`, `parseGitHubRepository`, `isStandalonePWA`, and
the proposed `isSafePWAEnv` options. The reports preserve the original reasoning and mark these
items as `already-in-mazey`; proposal drafts remain as historical design records.

The reports use six classifications:

- `strong-candidate`: a focused, independently testable contribution proposal not yet implemented.
- `generalize-first`: useful behavior still coupled to I/O, policy, or project state.
- `already-in-mazey`: the reviewed behavior is now available through a public Mazey API.
- `native-preferred`: a native JavaScript, browser, or Node.js operation is clearer.
- `project-specific`: useful in this template but not appropriate as a Mazey utility.
- `rejected`: too fragile, incomplete, context-sensitive, or trivial to promote.

## Review Order

1. Read [`candidates.md`](./candidates.md) for decisions and normalized APIs.
2. Use [`source-map.md`](./source-map.md) to trace every inspected helper to source.
3. Use [`candidates.json`](./candidates.json) for structured candidate data.
4. Review proposal drafts under [`proposals/`](./proposals/) before any contribution work.

No candidate should be copied into Mazey without rechecking the current Mazey source, supported
runtimes, naming conventions, tests, and release policy. The proposal snippets specify behavior;
they are not final Mazey patches.

## Rerunning The Collection

After future project work, repeat the repository search while excluding generated and dependency
directories, compare changed helpers with the then-installed Mazey declarations and source, update
line references, and rerun the validation checklist in `candidates.md`. Preserve reviewed decisions
unless changed behavior or new Mazey APIs justify a documented reclassification.
