/** @jest-environment jsdom */

const { initializeNavigation } = require("../site/navigation");
const { THEME_STORAGE_KEY, initializeThemeControls } = require("../site/theme");

test("theme selection follows the system and persists an explicit choice", () => {
  document.documentElement.removeAttribute("data-theme-controls-ready");
  document.body.innerHTML = `
    <label>Theme
      <select data-theme-select>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  `;
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
  localStorage.setItem(THEME_STORAGE_KEY, "system");
  const cleanup = initializeThemeControls();
  const select = document.querySelector("[data-theme-select]");

  expect(document.documentElement.dataset.bsTheme).toBe("dark");
  expect(select.value).toBe("system");
  select.value = "light";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  expect(document.documentElement.dataset.bsTheme).toBe("light");
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  expect(localStorage.getItem("tsd-theme")).toBe("light");
  expect(mediaListeners).toHaveLength(1);
  cleanup();
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
