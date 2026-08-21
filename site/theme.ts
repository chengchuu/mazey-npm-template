import {
  listenMediaQueryChanges,
  resolveThemePreference,
  setThemePreference,
} from "mazey";
import type { ResolvedTheme, ThemePreference } from "mazey";

export type { ThemePreference } from "mazey";

const systemThemeQuery = "(prefers-color-scheme: dark)";

function preferenceFromTypeDoc(value: string): ThemePreference | null {
  if (value === "os") return "system";
  if (value === "light" || value === "dark") return value;
  return null;
}

export function initializeThemeControls(storageKey: string): () => void {
  const root = document.documentElement;
  if (root.dataset.themeControlsReady === "true") return () => undefined;

  let media: MediaQueryList | null = null;
  try {
    media = window.matchMedia(systemThemeQuery);
  } catch {
    // Mazey resolves to its light fallback when system detection fails.
  }

  const initialTheme = resolveThemePreference(storageKey);
  let selectedPreference: ThemePreference =
    initialTheme.label === "System" ? "system" : initialTheme.value;
  let resolvedTheme: ResolvedTheme = initialTheme.value;

  const resolveSelectedTheme = (preference: ThemePreference): ResolvedTheme =>
    preference === "system" ? (media?.matches ? "dark" : "light") : preference;

  const apply = (preference: ThemePreference, theme: ResolvedTheme) => {
    resolvedTheme = theme;
    root.dataset.bsTheme = theme;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;

    const themeColor = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"][data-theme-color]',
    );
    if (themeColor) {
      themeColor.content =
        theme === "dark"
          ? (themeColor.dataset.themeColorDark ?? themeColor.content)
          : (themeColor.dataset.themeColorLight ?? themeColor.content);
    }

    const typeDocPreference = preference === "system" ? "os" : preference;
    try {
      window.localStorage.setItem("tsd-theme", typeDocPreference);
    } catch {
      // TypeDoc synchronization is optional when storage is unavailable.
    }

    const typeDocControl = document.getElementById("tsd-theme");
    if (
      typeDocControl instanceof HTMLSelectElement &&
      typeDocControl.value !== typeDocPreference
    ) {
      typeDocControl.value = typeDocPreference;
    }

    const currentTheme = theme === "light" ? "Light" : "Dark";
    const nextTheme = theme === "light" ? "dark" : "light";
    document
      .querySelectorAll<HTMLButtonElement>("[data-theme-toggle]")
      .forEach((button) => {
        button.setAttribute(
          "aria-label",
          `Current theme: ${currentTheme}. Switch to ${nextTheme} theme.`,
        );
        button
          .querySelectorAll<SVGElement>("[data-theme-icon]")
          .forEach((icon) => {
            icon.toggleAttribute("hidden", icon.dataset.themeIcon !== theme);
          });
      });
  };

  const handleClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>("[data-theme-toggle]");
    if (!button) return;

    selectedPreference = resolvedTheme === "light" ? "dark" : "light";
    setThemePreference(storageKey, selectedPreference);
    apply(selectedPreference, selectedPreference);
  };

  const handleChange = (event: Event) => {
    const control = event.target;
    if (!(control instanceof HTMLSelectElement) || control.id !== "tsd-theme")
      return;
    const preference = preferenceFromTypeDoc(control.value);
    if (!preference) {
      apply(selectedPreference, resolvedTheme);
      return;
    }

    selectedPreference = preference;
    setThemePreference(storageKey, preference);
    apply(preference, resolveSelectedTheme(preference));
  };

  const handleSystemTheme = (event: MediaQueryListEvent) => {
    if (selectedPreference === "system") {
      apply("system", event.matches ? "dark" : "light");
    }
  };

  root.dataset.themeControlsReady = "true";
  apply(selectedPreference, resolvedTheme);
  document.addEventListener("click", handleClick);
  document.addEventListener("change", handleChange);
  const removeMediaListener = listenMediaQueryChanges(media, handleSystemTheme);

  return () => {
    document.removeEventListener("click", handleClick);
    document.removeEventListener("change", handleChange);
    removeMediaListener();
    delete root.dataset.themeControlsReady;
  };
}
