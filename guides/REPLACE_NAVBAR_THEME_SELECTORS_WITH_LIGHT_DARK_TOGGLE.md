# Replace Navbar Theme Selectors with a Light/Dark Toggle

## Summary

Replace the Home, Playground, and generated TypeDoc toolbar theme selectors with synchronized
two-state icon buttons. Preserve TypeDoc 0.28.20's native `select#tsd-theme` Settings control and
the project's three-state persisted preference model.

No npm package API changes are introduced. Keep
`initializeThemeControls(storageKey): () => void` unchanged.

## Implementation Changes

- Add `bootstrap-icons` with `pnpm add -D bootstrap-icons`, updating only `package.json` and
  `pnpm-lock.yaml`. Inline the official `sun-fill.svg` and `moon-stars-fill.svg` path data; do not
  ship Bootstrap Icons CSS, fonts, files, CDN requests, or runtime dependencies.
- Replace navbar selects in the Home and Playground templates and the TypeDoc toolbar injection
  with `button.theme-toggle[data-theme-toggle]`:
  - Start with an internally consistent light state: show the sun and hide the moon.
  - Mark both SVGs with `aria-hidden="true"`, `focusable="false"`, and
    `data-theme-icon="light|dark"`.
  - Update the accessible label to describe the current theme and the result of activation.
  - Keep `type="button"` and do not add `aria-pressed`.
- Stop replacing `.tsd-theme-toggle` in `scripts/build-pages.js`. Preserve TypeDoc's generated
  `select#tsd-theme` with `os`, `light`, and `dark` options and synchronize it without
  reconstructing its markup or dispatching synthetic events.
- Refactor `site/theme.ts` to:
  - Verify the restored Mazey declarations, then import `listenMediaQueryChanges`,
    `resolveThemePreference`, and `setThemePreference` directly from Mazey.
  - Retain separate `selectedPreference` and concrete `resolvedTheme` state. Always apply
    `resolveThemePreference(storageKey).value` as the concrete initial theme; use the result label
    only to identify whether the selected preference is system, light, or dark.
  - Toggle explicitly to the opposite of the currently rendered theme and apply it even when
    persistence returns `false`.
  - Respond to `#tsd-theme` changes by mapping `os` to `system`.
  - Follow media-query changes only while the selected preference is `system`.
  - Preserve duplicate-initialization protection and cleanup through Mazey's standard media-query
    listener support.
- On every application, synchronize root `data-bs-theme`, root `data-theme`, `color-scheme`,
  `theme-color`, every navbar button and icon, TypeDoc's `tsd-theme` storage value, and
  `#tsd-theme` where present.
- Replace select-specific navbar CSS with button and SVG styles. Keep a minimum 44-by-44-pixel
  target on Home and Playground, collapsed-menu alignment, focus-visible treatment, and existing
  theme variables. Split TypeDoc Settings selectors from toolbar selectors so native Settings
  styling remains intact.
- Strengthen final-artifact validation:
  - Require an accessible `button[data-theme-toggle]` with `type="button"`, both correctly
    attributed SVG states, a valid label, and no `aria-pressed`.
  - Reject navbar `data-theme-select` controls.
  - Require exactly one native `select#tsd-theme` with the original ordered values and English
    labels on every generated API page.
- Update only the theme guidance in `AGENTS.md` to distinguish the two-state navbar control from the
  persisted three-state model and TypeDoc Settings. Preserve all existing unrelated worktree
  changes, including dependency and lockfile updates.

## Test Plan

- Expand `test/theme.test.js` for:
  - Template and button structure plus the exact Bootstrap icon paths.
  - URL, persisted, system, invalid-storage, unavailable-storage, and light-fallback initialization.
  - Icon visibility, accessible labels, root attributes, theme color, TypeDoc storage, and absence
    of `aria-pressed`.
  - System changes in both directions, explicit selections ignoring later system changes, repeated
    toggles, and failed persistence retaining session state.
  - Mazey standard media-listener registration, idempotent cleanup, and inert behavior for
    legacy-only listener objects.
  - Bidirectional synchronization with native `#tsd-theme`, including `os` mapping and no recursive
    events.
- Update Playground integration tests to click the theme button while retaining greeting and PWA
  coverage.
- Update SEO and TypeDoc transformation fixtures to retain the native Settings selector and assert
  the toolbar button contract across generated API pages.
- Run the focused Jest suites:

  ```bash
  npm test -- --runInBand test/theme.test.js test/playground.test.tsx test/seo.test.js
  ```

- Run the complete validation:

  ```bash
  npm run preview
  npm run format:check
  npm pack --dry-run
  git diff --check
  ```

- Inspect the packed manifest to confirm Bootstrap Icons and website code are absent. Run
  `npm run pwa:preview` for manual Home, Playground, API, system-theme, persistence, accessibility,
  responsive-navigation, and PWA verification, then stop the server.

## Assumptions

- Navbar activation always creates an explicit `light` or `dark` preference. Returning to `system`
  remains available through TypeDoc Settings on API pages or an existing stored `system` value.
- TypeDoc continues to own its native selector and listener. The project's delegated listener runs
  afterward and restores concrete root theme attributes.
- Generated directories are rebuilt only through their owning scripts and are not edited as
  maintained source.
- Existing unrelated worktree changes remain untouched.
