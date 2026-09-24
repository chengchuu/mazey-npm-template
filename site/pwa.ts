export interface SitePwaConfig {
  appName: string;
  enabled: boolean;
  scope: string;
  serviceWorkerUrl: string;
}

interface InstallChoice {
  outcome: "accepted" | "dismissed";
  platform?: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<InstallChoice>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

interface WindowWithIdleCallback {
  requestIdleCallback?: (callback: () => void) => number;
}

function listenForMediaChanges(
  media: MediaQueryList,
  listener: () => void,
): () => void {
  if (media.addEventListener) {
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }
  media.addListener(listener);
  return () => media.removeListener(listener);
}

function setHidden(elements: Element[], hidden: boolean): void {
  elements.forEach((element) => {
    if (element instanceof HTMLElement) element.hidden = hidden;
  });
}

function statusAnnouncer(documentRef: Document): (message: string) => void {
  const regions = Array.from(
    documentRef.querySelectorAll<HTMLElement>("[data-pwa-status]"),
  );
  return (message) =>
    regions.forEach((region) => (region.textContent = message));
}

export function isStandaloneMode(
  windowRef: Window,
  navigatorRef: NavigatorWithStandalone,
): boolean {
  return (
    windowRef.matchMedia("(display-mode: standalone)").matches ||
    navigatorRef.standalone === true
  );
}

export function shouldRegisterSiteServiceWorker(
  config: SitePwaConfig,
  locationRef: Location,
  navigatorRef: Navigator,
): boolean {
  try {
    const isLocalhost = new Set(["localhost", "127.0.0.1", "[::1]"]).has(
      locationRef.hostname,
    );
    return (
      config.enabled &&
      typeof navigatorRef.serviceWorker?.register === "function" &&
      (locationRef.protocol === "https:" || isLocalhost) &&
      locationRef.pathname.startsWith(config.scope)
    );
  } catch {
    return false;
  }
}

export function initializeInstallExperience(
  documentRef: Document,
  windowRef: Window,
  navigatorRef: NavigatorWithStandalone,
  appName: string,
): () => void {
  const installButtons = Array.from(
    documentRef.querySelectorAll<HTMLButtonElement>("[data-pwa-install]"),
  );
  const installHelp = Array.from(
    documentRef.querySelectorAll<HTMLElement>("[data-pwa-install-help]"),
  );
  const announce = statusAnnouncer(documentRef);
  const displayMode = windowRef.matchMedia("(display-mode: standalone)");
  let deferredPrompt: BeforeInstallPromptEvent | null = null;

  const setInstallButtonsHidden = (hidden: boolean) => {
    installButtons.forEach((button) => {
      button.hidden = hidden;
      const container = button.closest<HTMLElement>(
        "[data-pwa-install-container]",
      );
      if (container) container.hidden = hidden;
    });
  };

  const showInstalledState = () => {
    deferredPrompt = null;
    setInstallButtonsHidden(true);
    setHidden(installHelp, true);
  };

  const handlePromptAvailable = (event: Event) => {
    if (isStandaloneMode(windowRef, navigatorRef)) return;
    const promptEvent = event as BeforeInstallPromptEvent;
    promptEvent.preventDefault();
    deferredPrompt = promptEvent;
    installButtons.forEach((button) => {
      button.disabled = false;
    });
    setInstallButtonsHidden(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    installButtons.forEach((button) => (button.disabled = true));

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        announce("The app installation was accepted.");
      } else {
        announce(
          "Installation was dismissed. You can still use your browser's install menu later.",
        );
      }
    } catch {
      announce(
        "The browser could not open its installation prompt. Use the browser's install menu instead.",
      );
    } finally {
      setInstallButtonsHidden(true);
    }
  };

  const handleInstalled = () => {
    showInstalledState();
    announce(`${appName} was installed.`);
  };
  const handleDisplayMode = () => {
    if (isStandaloneMode(windowRef, navigatorRef)) showInstalledState();
  };

  if (isStandaloneMode(windowRef, navigatorRef)) showInstalledState();
  installButtons.forEach((button) =>
    button.addEventListener("click", handleInstall),
  );
  windowRef.addEventListener("beforeinstallprompt", handlePromptAvailable);
  windowRef.addEventListener("appinstalled", handleInstalled);
  const removeDisplayModeListener = listenForMediaChanges(
    displayMode,
    handleDisplayMode,
  );

  return () => {
    installButtons.forEach((button) =>
      button.removeEventListener("click", handleInstall),
    );
    windowRef.removeEventListener("beforeinstallprompt", handlePromptAvailable);
    windowRef.removeEventListener("appinstalled", handleInstalled);
    removeDisplayModeListener();
  };
}

export async function registerSiteServiceWorker(
  config: SitePwaConfig,
  windowRef: Window,
  navigatorRef: Navigator,
): Promise<ServiceWorkerRegistration | null> {
  if (
    !shouldRegisterSiteServiceWorker(config, windowRef.location, navigatorRef)
  ) {
    return null;
  }

  try {
    return await navigatorRef.serviceWorker.register(config.serviceWorkerUrl, {
      scope: config.scope,
    });
  } catch (error) {
    console.error(
      `Failed to register the ${config.appName} service worker.`,
      error,
    );
    return null;
  }
}

export function initializeSitePwa(config: SitePwaConfig): void {
  if (
    typeof document === "undefined" ||
    typeof window === "undefined" ||
    typeof navigator === "undefined"
  ) {
    return;
  }
  const root = document.documentElement;
  if (root.dataset.pwaReady === "true") return;
  root.dataset.pwaReady = "true";

  initializeInstallExperience(document, window, navigator, config.appName);
  if (!shouldRegisterSiteServiceWorker(config, window.location, navigator))
    return;

  const scheduleRegistration = () => {
    const idleWindow = window as unknown as WindowWithIdleCallback;
    if (idleWindow.requestIdleCallback) {
      idleWindow.requestIdleCallback(() => {
        void registerSiteServiceWorker(config, window, navigator);
      });
    } else {
      window.setTimeout(() => {
        void registerSiteServiceWorker(config, window, navigator);
      }, 0);
    }
  };

  if (document.readyState === "complete") scheduleRegistration();
  else window.addEventListener("load", scheduleRegistration, { once: true });
}
