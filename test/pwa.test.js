/** @jest-environment jsdom */

import { jest } from "@jest/globals";
import {
  initializeInstallExperience,
  isStandaloneMode,
  monitorServiceWorkerUpdates,
  registerSiteServiceWorker,
  shouldRegisterSiteServiceWorker,
} from "../site/pwa.ts";
import projectConfig from "../project.config.js";

const appName = projectConfig.brand.displayName;
const pwaConfig = {
  appName,
  enabled: true,
  scope: projectConfig.site.basePath,
  serviceWorkerUrl: projectConfig.pwa.serviceWorkerUrl,
};

function installMatchMedia(matches = false) {
  const media = new EventTarget();
  Object.assign(media, { matches, media: "(display-mode: standalone)" });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: jest.fn(() => media),
  });
  return media;
}

function renderInstallControls() {
  document.body.innerHTML = `
    <span data-pwa-install-container hidden>
      <button type="button" data-pwa-install hidden>Install app</button>
    </span>
    <section data-pwa-install-help>Website app help</section>
    <p role="status" aria-live="polite" data-pwa-status></p>
  `;
}

function installPrompt(outcome) {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  event.prompt = jest.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test.each([
  ["accepted", "The app installation was accepted."],
  [
    "dismissed",
    "Installation was dismissed. You can still use your browser's install menu later.",
  ],
])(
  "install prompt is captured and reports a %s choice",
  async (outcome, message) => {
    renderInstallControls();
    installMatchMedia(false);
    const cleanup = initializeInstallExperience(
      document,
      window,
      navigator,
      appName,
    );
    const event = installPrompt(outcome);

    window.dispatchEvent(event);
    const button = document.querySelector("[data-pwa-install]");
    expect(event.defaultPrevented).toBe(true);
    expect(button.hidden).toBe(false);
    expect(document.querySelector("[data-pwa-install-container]").hidden).toBe(
      false,
    );
    expect(event.prompt).not.toHaveBeenCalled();

    button.click();
    await settle();
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(button.hidden).toBe(true);
    expect(document.querySelector("[data-pwa-install-container]").hidden).toBe(
      true,
    );
    expect(document.querySelector("[data-pwa-status]").textContent).toBe(
      message,
    );
    cleanup();
  },
);

test("fallback help remains when no custom install event is available", () => {
  renderInstallControls();
  installMatchMedia(false);
  const cleanup = initializeInstallExperience(
    document,
    window,
    navigator,
    appName,
  );
  expect(document.querySelector("[data-pwa-install]").hidden).toBe(true);
  expect(document.querySelector("[data-pwa-install-help]").hidden).toBe(false);
  cleanup();
});

test("standalone mode and appinstalled hide installation controls", () => {
  renderInstallControls();
  installMatchMedia(true);
  const cleanup = initializeInstallExperience(
    document,
    window,
    navigator,
    appName,
  );
  expect(isStandaloneMode(window, navigator)).toBe(true);
  expect(document.querySelector("[data-pwa-install-help]").hidden).toBe(true);
  cleanup();

  renderInstallControls();
  installMatchMedia(false);
  const secondCleanup = initializeInstallExperience(
    document,
    window,
    navigator,
    appName,
  );
  window.dispatchEvent(new Event("appinstalled"));
  expect(document.querySelector("[data-pwa-install-help]").hidden).toBe(true);
  expect(document.querySelector("[data-pwa-status]").textContent).toBe(
    `${appName} was installed.`,
  );
  secondCleanup();
});

test("service-worker registration is production-scoped and uses exact paths", async () => {
  const registration = Object.assign(new EventTarget(), {
    installing: null,
    waiting: null,
  });
  const serviceWorker = Object.assign(new EventTarget(), {
    controller: null,
    register: jest.fn().mockResolvedValue(registration),
  });
  const navigatorRef = { serviceWorker };
  const config = pwaConfig;
  const siteUrl = new URL(projectConfig.site.url);
  const productionLocation = {
    hostname: siteUrl.hostname,
    pathname: projectConfig.site.basePath,
    protocol: siteUrl.protocol,
  };
  const windowRef = { location: productionLocation };

  expect(
    shouldRegisterSiteServiceWorker(
      { ...config, enabled: false },
      productionLocation,
      navigatorRef,
    ),
  ).toBe(false);
  expect(
    shouldRegisterSiteServiceWorker(config, productionLocation, navigatorRef),
  ).toBe(true);
  expect(
    shouldRegisterSiteServiceWorker(
      config,
      { ...productionLocation, pathname: "/another-project/" },
      navigatorRef,
    ),
  ).toBe(false);

  await registerSiteServiceWorker(config, document, windowRef, navigatorRef);
  expect(serviceWorker.register).toHaveBeenCalledWith(
    projectConfig.pwa.serviceWorkerUrl,
    { scope: projectConfig.site.basePath },
  );
});

test("waiting updates activate only after confirmation and reload once", () => {
  document.body.innerHTML = `
    <aside data-pwa-update hidden>
      <span>Update available</span>
      <button type="button" data-pwa-update-now>Update now</button>
    </aside>
    <p data-pwa-status></p>
  `;
  const waiting = { postMessage: jest.fn() };
  const registration = Object.assign(new EventTarget(), {
    installing: null,
    waiting,
  });
  const serviceWorker = Object.assign(new EventTarget(), {
    controller: {},
  });
  const navigatorRef = { serviceWorker };
  const windowRef = { location: { reload: jest.fn() } };

  const cleanup = monitorServiceWorkerUpdates(
    registration,
    document,
    navigatorRef,
    windowRef,
    appName,
  );
  expect(document.querySelector("[data-pwa-update]").hidden).toBe(false);
  serviceWorker.dispatchEvent(new Event("controllerchange"));
  expect(windowRef.location.reload).not.toHaveBeenCalled();

  document.querySelector("[data-pwa-update-now]").click();
  expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  serviceWorker.dispatchEvent(new Event("controllerchange"));
  serviceWorker.dispatchEvent(new Event("controllerchange"));
  expect(windowRef.location.reload).toHaveBeenCalledTimes(1);
  cleanup();
});

test("an update already installing at registration is announced", () => {
  document.body.innerHTML = `
    <aside data-pwa-update hidden><button data-pwa-update-now>Update now</button></aside>
    <p data-pwa-status></p>
  `;
  const installing = Object.assign(new EventTarget(), { state: "installing" });
  const registration = Object.assign(new EventTarget(), {
    installing,
    waiting: null,
  });
  const serviceWorker = Object.assign(new EventTarget(), { controller: {} });
  const cleanup = monitorServiceWorkerUpdates(
    registration,
    document,
    { serviceWorker },
    { location: { reload: jest.fn() } },
    appName,
  );

  installing.state = "installed";
  installing.dispatchEvent(new Event("statechange"));
  expect(document.querySelector("[data-pwa-update]").hidden).toBe(false);
  expect(document.querySelector("[data-pwa-status]").textContent).toBe(
    `A new version of the ${appName} website is available.`,
  );
  cleanup();
});
