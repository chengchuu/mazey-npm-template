import { resolveThemePreference, setThemePreference } from "mazey";
import type { ThemePreference, ThemePreferenceResult } from "mazey";

export type { ThemePreference } from "mazey";

const systemThemeQuery = "(prefers-color-scheme: dark)";

function listenForMediaChanges(
  media: MediaQueryList | null,
  listener: () => void,
): () => void {
  if (!media) return () => undefined;
  if (media.addEventListener) {
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }
  media.addListener(listener);
  return () => media.removeListener(listener);
}

export function initializeThemeControls(
  storageKey: string,
  documentRef: Document = document,
  windowRef: Window = window,
): () => void {
  const root = documentRef.documentElement;
  if (root.dataset.themeControlsReady === "true") return () => undefined;

  const storage = {
    getItem: (key: string) => windowRef.localStorage.getItem(key),
    setItem: (key: string, value: string) =>
      windowRef.localStorage.setItem(key, value),
  };
  let media: MediaQueryList | null = null;
  try {
    media = windowRef.matchMedia(systemThemeQuery);
  } catch {
    // Mazey resolves to the configured fallback when this adapter throws.
  }
  const matchMedia = () => {
    if (!media) throw new Error("System theme detection is unavailable.");
    return media;
  };

  const apply = ({ preference, resolvedTheme }: ThemePreferenceResult) => {
    root.dataset.bsTheme = resolvedTheme;
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
    const themeColor = documentRef.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"][data-theme-color]',
    );
    if (themeColor) {
      themeColor.content =
        resolvedTheme === "dark"
          ? (themeColor.dataset.themeColorDark ?? themeColor.content)
          : (themeColor.dataset.themeColorLight ?? themeColor.content);
    }

    try {
      storage.setItem("tsd-theme", preference === "system" ? "os" : preference);
    } catch {
      // TypeDoc synchronization is optional when storage is unavailable.
    }

    documentRef
      .querySelectorAll<HTMLSelectElement>("[data-theme-select]")
      .forEach((control) => {
        if (control.value !== preference) control.value = preference;
      });
  };

  const initialTheme = resolveThemePreference({
    storageKey,
    url: documentRef.URL,
    storage,
    matchMedia,
    fallback: "light",
  });
  let selectedPreference = initialTheme.preference;
  const sessionUrl = new URL(documentRef.URL);
  sessionUrl.searchParams.delete("theme");
  const resolveSelectedTheme = () =>
    resolveThemePreference({
      storageKey,
      url: sessionUrl,
      storage: { getItem: () => selectedPreference },
      matchMedia,
      fallback: "light",
    });

  const handleChange = (event: Event) => {
    const control = event.target;
    if (!(control instanceof HTMLSelectElement)) return;
    if (!control.matches("[data-theme-select]")) return;
    const preference = control.value as ThemePreference;
    try {
      setThemePreference({ storageKey, preference, storage });
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      apply(resolveSelectedTheme());
      return;
    }
    selectedPreference = preference;
    apply(resolveSelectedTheme());
  };
  const handleSystemTheme = () => {
    if (selectedPreference === "system") apply(resolveSelectedTheme());
  };

  root.dataset.themeControlsReady = "true";
  apply(initialTheme);
  documentRef.addEventListener("change", handleChange);
  const removeMediaListener = listenForMediaChanges(media, handleSystemTheme);

  return () => {
    documentRef.removeEventListener("change", handleChange);
    removeMediaListener();
    delete root.dataset.themeControlsReady;
  };
}
