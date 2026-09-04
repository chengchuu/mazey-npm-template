# Convert Website Theme Handling to Light/Dark Only

## Summary

Remove `system` as an application preference across Home, Playground, and `/api/`. Keep only
concrete `light` and `dark` runtime and persisted states. When no explicit preference exists,
resolve the operating-system theme once during initialization without saving it or following later
OS changes.

Preserve the existing navbar buttons. Keep TypeDoc's native Settings selector and listener, but
remove its `OS` option so it exposes only `Light` and `Dark`.

No npm package API changes are required. Keep
`initializeThemeControls(storageKey): () => void` unchanged.

## Implementation Changes

- Simplify `site/theme.ts` to one `ResolvedTheme` state:
  - Initialize from `resolveThemePreference(storageKey).value`.
  - Remove `selectedPreference`, `ThemePreference`, `preferenceFromTypeDoc`, `matchMedia`, and
    `listenMediaQueryChanges`.
  - Persist only `light` or `dark` through `setThemePreference()`.
  - Keep the selected theme active for the session when persistence returns `false`.
  - Preserve Mazey's key-specific, read-only URL preference behavior. For this template, the
    parameter is `?mazey-npm-template-theme=light|dark`.
  - Do not write the project storage key when the initial theme only came from the OS. TypeDoc's
    separate `tsd-theme` value may still be synchronized to the concrete theme.
- Restrict TypeDoc to two states during Pages assembly:
  - Remove only `<option value="os">OS</option>` from the generated `select#tsd-theme`.
  - Retain the native select, listener, surrounding markup, and styles.
  - Fail the transformation if the expected selector or single `os` option is missing so a TypeDoc
    upgrade cannot silently bypass the policy.
  - Keep the existing script order so TypeDoc initializes before the project API script leaves the
    final root state concrete, including when storage is unavailable.
  - Synchronize the selector and TypeDoc's `tsd-theme` storage value exclusively to `light` or
    `dark`.
  - Restore the current valid theme if the selector supplies an unsupported value. Do not dispatch
    a synthetic `change` event.
- Preserve all existing theme side effects: root `data-bs-theme`, root `data-theme`,
  `color-scheme`, `theme-color`, navbar icons, dynamic accessible labels,
  duplicate-initialization protection, and cleanup.
- Update final-artifact validation to require exactly the ordered `Light` and `Dark` TypeDoc
  options and reject `OS`.
- Update `AGENTS.md` and `guides/REPLACE_NAVBAR_THEME_SELECTORS_WITH_LIGHT_DARK_TOGGLE.md` to document
  the two-state contract and one-time OS resolution. Leave the external reusable prompt under
  `/Users/cheng/web/server/docs/Prompt/` unchanged.
- Make no package output, dependency metadata, CSS, navbar markup, PWA, routing, or release changes.
  `bootstrap-icons` is already declared and locked.

## Test Plan

- Update theme tests for:
  - URL and saved light/dark preferences;
  - one-time OS resolution, invalid storage, unavailable storage, and the light fallback;
  - no project preference written during OS-derived initialization;
  - no reaction to OS changes after initialization and no media-query listener registration;
  - repeated navbar toggles and session behavior when persistence fails;
  - root attributes, metadata, icons, and accessible labels;
  - TypeDoc Light/Dark synchronization, unsupported-value recovery, and no recursive events.
- Remove obsolete system-preference, live media-listener, and legacy-listener tests.
- Update Pages and SEO tests to verify that every generated API page retains one native
  `select#tsd-theme` with only `light`/`Light` and `dark`/`Dark`. Preserve the existing navbar button
  and icon assertions.
- If `node_modules/bootstrap-icons` remains missing, restore the already-declared dependencies with
  `npm install`. Do not change dependency metadata or the tracked `pnpm-lock.yaml`.
- Run focused and aggregate validation:

  ```bash
  npm test -- --runInBand test/theme.test.js test/playground.test.tsx test/seo.test.js
  npm run preview
  npm run format:check
  npm pack --dry-run
  git diff --check
  ```

- Run `npm run pwa:preview` and verify Home, Playground, and API initial resolution, explicit
  persistence, Light/Dark controls, responsive navigation, theme metadata, and PWA behavior. Confirm
  that `/api/` never displays `OS`, then stop the preview server.
- Inspect the package manifest to confirm the theme implementation and Bootstrap Icons remain
  outside the published runtime package.

## Assumptions

- The package has no released versions or existing users, so no migration or compatibility handling
  for stored `system` values is required.
- The OS preference is only an initial default when no explicit light/dark choice exists. Changing
  the OS theme while a page is open does not update the site.
- User interaction is the only operation that persists the project's light/dark preference, except
  for Mazey's existing explicit URL-query behavior.
