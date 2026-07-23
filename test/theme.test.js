/** @jest-environment jsdom */

import { jest } from "@jest/globals";
import { initializeNavigation } from "../site/navigation.ts";
import { initializeThemeControls } from "../site/theme.ts";
import projectConfig from "../project.config.js";

const { colorPrimary, colorLight, colorDark, storageKey } =
  projectConfig.site.theme;

afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
  history.replaceState({}, "", "/");
});

function renderThemeControl() {
  document.documentElement.removeAttribute("data-theme-controls-ready");
  document.head.innerHTML = `
    <meta name="theme-color" content="${colorPrimary}" data-theme-color
      data-theme-color-light="${colorLight}" data-theme-color-dark="${colorDark}">
  `;
  document.body.innerHTML = `
    <label>Theme
      <select data-theme-select>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  `;
}

test("initial theme follows URL, storage, system, and fallback precedence", () => {
  renderThemeControl();
  history.replaceState({}, "", "/?theme=dark");
  localStorage.setItem(storageKey, "light");
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });
  const cleanup = initializeThemeControls(storageKey);
  const select = document.querySelector("[data-theme-select]");

  expect(document.documentElement.dataset.bsTheme).toBe("dark");
  expect(select.value).toBe("dark");
  expect(localStorage.getItem(storageKey)).toBe("light");
  expect(localStorage.getItem("tsd-theme")).toBe("dark");
  cleanup();
});

test("persisted theme overrides the system color scheme", () => {
  renderThemeControl();
  localStorage.setItem(storageKey, "light");
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });
  const cleanup = initializeThemeControls(storageKey);

  expect(document.documentElement.dataset.bsTheme).toBe("light");
  expect(document.querySelector("[data-theme-select]").value).toBe("light");
  cleanup();
});

test("system preference tracks color-scheme changes until the user selects a theme", () => {
  renderThemeControl();
  const mediaListeners = [];
  const media = {
    matches: false,
    addEventListener: (_name, listener) => mediaListeners.push(listener),
    removeEventListener: jest.fn(),
  };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => media,
  });
  const cleanup = initializeThemeControls(storageKey);
  const select = document.querySelector("[data-theme-select]");

  expect(document.documentElement.dataset.bsTheme).toBe("light");
  expect(select.value).toBe("system");
  media.matches = true;
  mediaListeners[0]();
  expect(document.documentElement.dataset.bsTheme).toBe("dark");
  expect(document.querySelector('meta[name="theme-color"]').content).toBe(
    colorDark,
  );

  select.value = "light";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  expect(document.documentElement.dataset.bsTheme).toBe("light");
  expect(document.querySelector('meta[name="theme-color"]').content).toBe(
    colorLight,
  );
  expect(localStorage.getItem(storageKey)).toBe("light");
  expect(localStorage.getItem("tsd-theme")).toBe("light");
  expect(mediaListeners).toHaveLength(1);

  media.matches = false;
  mediaListeners[0]();
  expect(document.documentElement.dataset.bsTheme).toBe("light");
  cleanup();
});

test("invalid stored preferences fall through to the system theme", () => {
  renderThemeControl();
  localStorage.setItem(storageKey, "corrupted");
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });
  const cleanup = initializeThemeControls(storageKey);

  expect(document.documentElement.dataset.bsTheme).toBe("dark");
  expect(document.querySelector("[data-theme-select]").value).toBe("system");
  expect(localStorage.getItem("tsd-theme")).toBe("os");
  cleanup();
});

test("theme initialization uses the light fallback without system detection", () => {
  renderThemeControl();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => {
      throw new Error("Media query unavailable");
    },
  });
  const cleanup = initializeThemeControls(storageKey);

  expect(document.documentElement.dataset.bsTheme).toBe("light");
  expect(document.querySelector("[data-theme-select]").value).toBe("light");
  cleanup();
});

test("unavailable storage does not prevent session-only theme selection", () => {
  renderThemeControl();
  const mediaListeners = [];
  const media = {
    matches: true,
    addEventListener: (_name, listener) => mediaListeners.push(listener),
    removeEventListener: jest.fn(),
  };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => media,
  });
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("Storage unavailable", "SecurityError");
  });
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage unavailable", "SecurityError");
  });

  let cleanup;
  expect(() => {
    cleanup = initializeThemeControls(storageKey);
  }).not.toThrow();
  expect(document.documentElement.dataset.bsTheme).toBe("dark");
  const select = document.querySelector("[data-theme-select]");
  select.value = "light";
  expect(() =>
    select.dispatchEvent(new Event("change", { bubbles: true })),
  ).not.toThrow();
  expect(document.documentElement.dataset.bsTheme).toBe("light");

  media.matches = false;
  mediaListeners[0]();
  expect(document.documentElement.dataset.bsTheme).toBe("light");
  cleanup();
});

test("unsupported control values are ignored without losing the selected theme", () => {
  renderThemeControl();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });
  const cleanup = initializeThemeControls(storageKey);
  const select = document.querySelector("[data-theme-select]");
  const unsupported = document.createElement("option");
  unsupported.value = "unsupported";
  unsupported.textContent = "Unsupported";
  select.append(unsupported);
  select.value = unsupported.value;

  expect(() =>
    select.dispatchEvent(new Event("change", { bubbles: true })),
  ).not.toThrow();
  expect(document.documentElement.dataset.bsTheme).toBe("light");
  expect(select.value).toBe("system");
  expect(localStorage.getItem(storageKey)).toBeNull();
  cleanup();
});

test("theme changes support legacy MediaQueryList listeners", () => {
  renderThemeControl();
  localStorage.clear();
  const media = {
    matches: false,
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => media,
  });
  const cleanup = initializeThemeControls(storageKey);

  expect(media.addListener).toHaveBeenCalledTimes(1);
  cleanup();
  expect(media.removeListener).toHaveBeenCalledTimes(1);
});

test("Bootstrap navigation closes on Escape and restores toggle focus", () => {
  document.documentElement.removeAttribute("data-nav-enhanced");
  document.body.innerHTML = `
    <nav data-site-navbar>
      <button type="button" aria-expanded="false" data-nav-toggle>Menu</button>
      <div id="navigation" data-mobile-nav><a href="#target">Target</a></div>
    </nav>
  `;
  const navigation = document.querySelector("[data-mobile-nav]");
  const toggle = document.querySelector("[data-nav-toggle]");
  const instance = {
    toggle: jest.fn(() => {
      navigation.dispatchEvent(new Event("show.bs.collapse"));
      navigation.classList.add("show");
    }),
    hide: jest.fn(() => {
      navigation.dispatchEvent(new Event("hide.bs.collapse"));
      navigation.classList.remove("show");
      navigation.dispatchEvent(new Event("hidden.bs.collapse"));
    }),
  };
  const Collapse = {
    getOrCreateInstance: jest.fn(() => instance),
  };

  initializeNavigation(Collapse);
  initializeNavigation(Collapse);
  toggle.click();
  expect(instance.toggle).toHaveBeenCalledTimes(1);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect(instance.hide).toHaveBeenCalledTimes(1);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(toggle);
  expect(Collapse.getOrCreateInstance).toHaveBeenCalledTimes(1);
});
