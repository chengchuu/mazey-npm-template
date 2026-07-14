export interface SitePwaConfig {
  appName: string;
  enabled: boolean;
  serviceWorkerFile: string;
}

export interface SitePwaUrls {
  manifestUrl: string;
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

export function resolveSitePwaUrls(
  documentRef: Document,
  locationRef: Location,
  serviceWorkerFile = "service-worker.js",
): SitePwaUrls | null {
  const manifestHref = documentRef
    .querySelector<HTMLLinkElement>('link[rel="manifest"]')
    ?.getAttribute("href");
  if (!manifestHref) return null;

  try {
    const pageUrl = new URL(locationRef.href);
    const manifestUrl = new URL(manifestHref, pageUrl);
    if (manifestUrl.origin !== pageUrl.origin) return null;
    const siteRoot = new URL("./", manifestUrl);
    return {
      manifestUrl: manifestUrl.href,
      scope: siteRoot.href,
      serviceWorkerUrl: new URL(serviceWorkerFile, siteRoot).href,
    };
  } catch {
    return null;
  }
}

export function shouldRegisterSiteServiceWorker(
  config: SitePwaConfig,
  documentRef: Document,
  locationRef: Location,
  navigatorRef: Navigator,
): boolean {
  const isLocalhost = new Set(["localhost", "127.0.0.1", "[::1]"]).has(
    locationRef.hostname,
  );
  const urls = resolveSitePwaUrls(
    documentRef,
    locationRef,
    config.serviceWorkerFile,
  );
  if (!urls) return false;
  const scope = new URL(urls.scope);
  return (
    config.enabled &&
    "serviceWorker" in navigatorRef &&
    (locationRef.protocol === "https:" || isLocalhost) &&
    scope.origin === new URL(locationRef.href).origin &&
    locationRef.pathname.startsWith(scope.pathname)
  );
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
  displayMode.addEventListener?.("change", handleDisplayMode);

  return () => {
    installButtons.forEach((button) =>
      button.removeEventListener("click", handleInstall),
    );
    windowRef.removeEventListener("beforeinstallprompt", handlePromptAvailable);
    windowRef.removeEventListener("appinstalled", handleInstalled);
    displayMode.removeEventListener?.("change", handleDisplayMode);
  };
}

export function monitorServiceWorkerUpdates(
  registration: ServiceWorkerRegistration,
  documentRef: Document,
  navigatorRef: Navigator,
  windowRef: Window,
  appName: string,
): () => void {
  const notice = documentRef.querySelector<HTMLElement>("[data-pwa-update]");
  const updateButton = documentRef.querySelector<HTMLButtonElement>(
    "[data-pwa-update-now]",
  );
  const announce = statusAnnouncer(documentRef);
  let waitingWorker: ServiceWorker | null = registration.waiting;
  let installingWorker: ServiceWorker | null = null;
  let reloadRequested = false;

  const showUpdate = (worker: ServiceWorker) => {
    waitingWorker = worker;
    if (notice) notice.hidden = false;
    announce(`A new version of the ${appName} website is available.`);
  };

  const handleStateChange = () => {
    if (
      installingWorker?.state === "installed" &&
      navigatorRef.serviceWorker.controller
    )
      showUpdate(installingWorker);
  };
  const handleUpdateFound = () => {
    installingWorker?.removeEventListener("statechange", handleStateChange);
    installingWorker = registration.installing;
    installingWorker?.addEventListener("statechange", handleStateChange);
    handleStateChange();
  };
  const handleUpdate = () => {
    if (!waitingWorker) return;
    reloadRequested = true;
    if (updateButton) updateButton.disabled = true;
    announce("Updating the website now.");
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };
  const handleControllerChange = () => {
    if (notice) notice.hidden = true;
    if (!reloadRequested) return;
    reloadRequested = false;
    windowRef.location.reload();
  };

  if (registration.waiting && navigatorRef.serviceWorker.controller)
    showUpdate(registration.waiting);
  registration.addEventListener("updatefound", handleUpdateFound);
  if (registration.installing) handleUpdateFound();
  updateButton?.addEventListener("click", handleUpdate);
  navigatorRef.serviceWorker.addEventListener(
    "controllerchange",
    handleControllerChange,
  );

  return () => {
    registration.removeEventListener("updatefound", handleUpdateFound);
    installingWorker?.removeEventListener("statechange", handleStateChange);
    updateButton?.removeEventListener("click", handleUpdate);
    navigatorRef.serviceWorker.removeEventListener(
      "controllerchange",
      handleControllerChange,
    );
  };
}

export async function registerSiteServiceWorker(
  config: SitePwaConfig,
  documentRef: Document,
  windowRef: Window,
  navigatorRef: Navigator,
): Promise<ServiceWorkerRegistration | null> {
  const urls = resolveSitePwaUrls(
    documentRef,
    windowRef.location,
    config.serviceWorkerFile,
  );
  if (
    !urls ||
    !shouldRegisterSiteServiceWorker(
      config,
      documentRef,
      windowRef.location,
      navigatorRef,
    )
  ) {
    return null;
  }

  try {
    const registration = await navigatorRef.serviceWorker.register(
      urls.serviceWorkerUrl,
      { scope: urls.scope },
    );
    monitorServiceWorkerUpdates(
      registration,
      documentRef,
      navigatorRef,
      windowRef,
      config.appName,
    );
    return registration;
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
  if (
    !shouldRegisterSiteServiceWorker(
      config,
      document,
      window.location,
      navigator,
    )
  )
    return;

  const scheduleRegistration = () => {
    const idleWindow = window as unknown as WindowWithIdleCallback;
    if (idleWindow.requestIdleCallback) {
      idleWindow.requestIdleCallback(() => {
        void registerSiteServiceWorker(config, document, window, navigator);
      });
    } else {
      window.setTimeout(() => {
        void registerSiteServiceWorker(config, document, window, navigator);
      }, 0);
    }
  };

  if (document.readyState === "complete") scheduleRegistration();
  else window.addEventListener("load", scheduleRegistration, { once: true });
}
