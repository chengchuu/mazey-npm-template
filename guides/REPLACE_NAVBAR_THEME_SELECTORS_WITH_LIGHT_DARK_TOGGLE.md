# Replace Navbar Theme Selectors with a Light/Dark Toggle

## Summary

The Home, Playground, and generated TypeDoc toolbar use synchronized two-state icon buttons.
TypeDoc 0.28.20's native `select#tsd-theme` Settings control remains available with only its
`Light` and `Dark` options.

No npm package API changes are introduced. Keep
`initializeThemeControls(storageKey): () => void` unchanged.

## Theme Contract

- The application exposes and persists only `light` and `dark` preferences.
- When neither a URL preference nor a persisted preference exists, Mazey resolves the OS color
  scheme once during initialization. The project does not persist that fallback or react to later
  `prefers-color-scheme` changes.
- URL preferences use the configured storage key as the query parameter. For this template,
  `?mazey-npm-template-theme=light` and `?mazey-npm-template-theme=dark` override storage without
  rewriting it.
- Every explicit navbar or TypeDoc selection is persisted with
  `setThemePreference(storageKey, theme)`.
- A failed storage write does not block the selected theme from applying for the current session.

## Implementation

- Home and Playground templates and the injected TypeDoc project toolbar use
  `button.theme-toggle[data-theme-toggle]` with inline Bootstrap `sun-fill` and `moon-stars-fill`
  icons.
- Buttons use `type="button"` and a changing accessible label that describes the current theme and
  the result of activation. They do not use `aria-pressed` because activation performs a command
  whose label and icon change rather than exposing a persistent pressed state.
- `site/theme.ts` imports `resolveThemePreference` and `setThemePreference` directly from Mazey. It
  keeps only the current concrete `light | dark` theme in local state.
- Applying a theme synchronizes:
  - root `data-bs-theme` and `data-theme` attributes;
  - root `color-scheme` styling;
  - browser `theme-color` metadata;
  - every navbar button label and icon;
  - TypeDoc's `tsd-theme` storage value and native selector.
- `scripts/build-pages.js` preserves TypeDoc's selector, markup, styles, and listener. During Pages
  assembly, it removes exactly the generated `<option value="os">OS</option>` and fails clearly if
  the expected selector or option is absent from fresh TypeDoc output.
- TypeDoc's generated script initializes before the project API script. The project script then
  applies a concrete theme and restores unsupported selector values without dispatching synthetic
  change events.

## Validation Contract

Every generated API page must contain:

- one native `select#tsd-theme`;
- exactly the ordered `light`/`Light` and `dark`/`Dark` options;
- one project navbar theme button with both decorative theme icons;
- no `OS` option, obsolete navbar theme selector, or `aria-pressed` attribute.

Tests cover URL and persisted precedence, one-time OS initialization, unavailable storage and media
queries, repeated button toggles, TypeDoc synchronization, unsupported values, duplicate
initialization, cleanup, and generated Pages validation.

Run the focused checks while changing theme behavior:

```bash
npm test -- --runInBand test/theme.test.js test/playground.test.tsx test/seo.test.js
```

Then run the repository's complete preview, formatting, package, and diff checks documented in
`AGENTS.md`.
