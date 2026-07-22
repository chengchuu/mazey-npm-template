/** @jest-environment jsdom */

import { jest } from "@jest/globals";
import { initializeNavigation } from "../site/navigation.ts";
import { initializeThemeControls } from "../site/theme.ts";
import projectConfig from "../project.config.js";

const { colorPrimary, colorLight, colorDark, storageKey } =
  projectConfig.site.theme;

afterEach(() => {
  localStorage.clear();
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

test("theme selection follows the system and persists an explicit choice", () => {
  renderThemeControl();
  const mediaListeners = [];
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: true,
      addEventListener: (_name, listener) => mediaListeners.push(listener),
      removeEventListener: jest.fn(),
    }),
  });
  localStorage.clear();
  localStorage.setItem(storageKey, "system");
  const cleanup = initializeThemeControls(storageKey);
  const select = document.querySelector("[data-theme-select]");

  expect(document.documentElement.dataset.bsTheme).toBe("dark");
  expect(document.querySelector('meta[name="theme-color"]').content).toBe(
    colorDark,
  );
  expect(select.value).toBe("system");
  select.value = "light";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  expect(document.documentElement.dataset.bsTheme).toBe("light");
  expect(document.querySelector('meta[name="theme-color"]').content).toBe(
    colorLight,
  );
  expect(localStorage.getItem(storageKey)).toBe("light");
  expect(localStorage.getItem("tsd-theme")).toBe("light");
  expect(mediaListeners).toHaveLength(1);
  cleanup();
});

test("theme initialization tolerates inaccessible local storage", () => {
  renderThemeControl();
  const media = {
    matches: true,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  const windowRef = {
    get localStorage() {
      throw new DOMException("Storage unavailable", "SecurityError");
    },
    matchMedia: () => media,
  };

  let cleanup;
  expect(() => {
    cleanup = initializeThemeControls(storageKey, document, windowRef);
  }).not.toThrow();
  expect(document.documentElement.dataset.bsTheme).toBe("dark");
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
  const windowRef = {
    localStorage,
    matchMedia: () => media,
  };
  const cleanup = initializeThemeControls(storageKey, document, windowRef);

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
