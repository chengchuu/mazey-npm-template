/** @jest-environment jsdom */

import { readFileSync } from "node:fs";
import path from "node:path";
import { jest } from "@jest/globals";
import { initializeNavigation } from "../site/navigation.ts";
import { initializeThemeControls } from "../site/theme.ts";
import projectConfig from "../project.config.js";

const { colorPrimary, colorLight, colorDark, storageKey } =
  projectConfig.site.theme;

function mediaQuery(initialMatches = false) {
  const media = {
    matches: initialMatches,
    change(matches) {
      media.matches = matches;
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  return media;
}

function renderThemeControls({ typeDoc = false } = {}) {
  document.documentElement.removeAttribute("data-theme-controls-ready");
  document.head.innerHTML = `
    <meta name="theme-color" content="${colorPrimary}" data-theme-color
      data-theme-color-light="${colorLight}" data-theme-color-dark="${colorDark}">
  `;
  document.body.innerHTML = `
    <button type="button" data-theme-toggle
      aria-label="Current theme: Light. Switch to dark theme.">
      <svg data-theme-icon="light" aria-hidden="true" focusable="false"></svg>
      <svg data-theme-icon="dark" aria-hidden="true" focusable="false" hidden></svg>
    </button>
    ${
      typeDoc
        ? `<select id="tsd-theme">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>`
        : ""
    }
  `;
}

function installMatchMedia(media) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: jest.fn(() => media),
  });
}

function themeButton() {
  return document.querySelector("[data-theme-toggle]");
}

function expectRenderedTheme(theme) {
  const button = themeButton();
  const lightIcon = button.querySelector('[data-theme-icon="light"]');
  const darkIcon = button.querySelector('[data-theme-icon="dark"]');
  const current = theme === "light" ? "Light" : "Dark";
  const next = theme === "light" ? "dark" : "light";

  expect(document.documentElement.dataset.bsTheme).toBe(theme);
  expect(document.documentElement.dataset.theme).toBe(theme);
  expect(document.documentElement.style.colorScheme).toBe(theme);
  expect(button.getAttribute("aria-label")).toBe(
    `Current theme: ${current}. Switch to ${next} theme.`,
  );
  expect(button.hasAttribute("aria-pressed")).toBe(false);
  expect(lightIcon.hasAttribute("hidden")).toBe(theme !== "light");
  expect(darkIcon.hasAttribute("hidden")).toBe(theme !== "dark");
  expect(document.querySelector('meta[name="theme-color"]').content).toBe(
    theme === "light" ? colorLight : colorDark,
  );
}

afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
  history.replaceState({}, "", "/");
  document.documentElement.removeAttribute("data-theme-controls-ready");
  document.documentElement.removeAttribute("data-bs-theme");
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.removeProperty("color-scheme");
});

test("navbar templates use the official inline Bootstrap theme icons", () => {
  const sunSvg = readFileSync(
    path.join("node_modules", "bootstrap-icons", "icons", "sun-fill.svg"),
    "utf8",
  );
  const moonSvg = readFileSync(
    path.join(
      "node_modules",
      "bootstrap-icons",
      "icons",
      "moon-stars-fill.svg",
    ),
    "utf8",
  );
  const iconPaths = [
    ...sunSvg.matchAll(/d="([^"]+)"/g),
    ...moonSvg.matchAll(/d="([^"]+)"/g),
  ].map((match) => match[1]);

  for (const file of ["site/index.html", "examples/index.html"]) {
    const html = readFileSync(file, "utf8");
    expect(html).toContain("button");
    expect(html).toContain("data-theme-toggle");
    expect(html).toContain('type="button"');
    expect(html).toContain(
      'aria-label="Current theme: Light. Switch to dark theme."',
    );
    expect(html).toContain('data-theme-icon="light"');
    expect(html).toMatch(/data-theme-icon="dark"\s+hidden/);
    expect(html).not.toContain("data-theme-select");
    expect(html).not.toContain("aria-pressed");
    const icons = [
      ...html.matchAll(/<svg\b[^>]*data-theme-icon="(?:light|dark)"[^>]*>/g),
    ];
    expect(icons).toHaveLength(2);
    for (const [icon] of icons) {
      expect(icon).toContain('width="16"');
      expect(icon).toContain('height="16"');
    }
    for (const iconPath of iconPaths) expect(html).toContain(iconPath);
  }
});

test("theme toggles use compact circular targets and 16px icons", () => {
  const siteCss = readFileSync("site/site.css", "utf8");
  const apiCss = readFileSync("site/api.css", "utf8");
  const siteButton = siteCss.match(/\.theme-toggle\s*\{([^}]*)\}/)?.[1];
  const siteIcon = siteCss.match(/\.theme-toggle svg\s*\{([^}]*)\}/)?.[1];
  const apiButton = apiCss.match(
    /\.site-project-links \.theme-toggle\s*\{([^}]*)\}/,
  )?.[1];
  const apiIcon = apiCss.match(
    /\.site-project-links \.theme-toggle svg\s*\{([^}]*)\}/,
  )?.[1];

  expect(siteButton).toMatch(/(?:^|\s)width: 32px;/);
  expect(siteButton).toMatch(/(?:^|\s)height: 32px;/);
  expect(siteButton).toMatch(/(?:^|\s)padding: 7px;/);
  expect(siteButton).toContain("box-sizing: border-box");
  expect(siteButton).toContain("border-radius: 50%");
  expect(siteIcon).toMatch(/(?:^|\s)width: 16px;/);
  expect(siteIcon).toMatch(/(?:^|\s)height: 16px;/);
  expect(apiButton).toMatch(/(?:^|\s)width: 28px;/);
  expect(apiButton).toMatch(/(?:^|\s)height: 28px;/);
  expect(apiButton).toContain("box-sizing: border-box");
  expect(apiButton).toContain("border-radius: 50%");
  expect(apiIcon).toMatch(/(?:^|\s)width: 16px;/);
  expect(apiIcon).toMatch(/(?:^|\s)height: 16px;/);
});

test("URL preference overrides storage and initializes every theme side effect", () => {
  renderThemeControls({ typeDoc: true });
  history.replaceState({}, "", "/?theme=dark");
  localStorage.setItem(storageKey, "light");
  installMatchMedia(mediaQuery(false));

  const cleanup = initializeThemeControls(storageKey);

  expectRenderedTheme("dark");
  expect(localStorage.getItem(storageKey)).toBe("dark");
  expect(localStorage.getItem("tsd-theme")).toBe("dark");
  expect(document.querySelector("#tsd-theme").value).toBe("dark");
  cleanup();
});

test.each([
  ["light", true],
  ["dark", false],
])("saved %s preference ignores later OS changes", (preference, matches) => {
  renderThemeControls();
  localStorage.setItem(storageKey, preference);
  const media = mediaQuery(matches);
  installMatchMedia(media);

  const cleanup = initializeThemeControls(storageKey);
  expectRenderedTheme(preference);
  expect(media.addEventListener).not.toHaveBeenCalled();
  media.change(!matches);
  expectRenderedTheme(preference);
  cleanup();
});

test.each([
  [false, "light"],
  [true, "dark"],
])("missing preference resolves OS %s once as %s", (matches, expected) => {
  renderThemeControls({ typeDoc: true });
  const media = mediaQuery(matches);
  installMatchMedia(media);

  const cleanup = initializeThemeControls(storageKey);
  expectRenderedTheme(expected);
  expect(localStorage.getItem(storageKey)).toBeNull();
  expect(document.querySelector("#tsd-theme").value).toBe(expected);
  expect(localStorage.getItem("tsd-theme")).toBe(expected);
  expect(media.addEventListener).not.toHaveBeenCalled();

  media.change(!matches);
  expectRenderedTheme(expected);
  cleanup();
});

test.each([
  [false, "dark"],
  [true, "light"],
])(
  "first navbar click from OS %s selects and persists %s",
  (matches, expected) => {
    renderThemeControls();
    const media = mediaQuery(matches);
    installMatchMedia(media);

    const cleanup = initializeThemeControls(storageKey);
    themeButton().click();
    expectRenderedTheme(expected);
    expect(localStorage.getItem(storageKey)).toBe(expected);
    expect(localStorage.getItem("tsd-theme")).toBe(expected);

    media.change(!matches);
    expectRenderedTheme(expected);
    cleanup();
  },
);

test("repeated navbar toggles persist every explicit selection", () => {
  renderThemeControls();
  installMatchMedia(mediaQuery(false));
  const setItem = jest.spyOn(Storage.prototype, "setItem");

  const cleanup = initializeThemeControls(storageKey);
  themeButton().click();
  expectRenderedTheme("dark");
  themeButton().click();
  expectRenderedTheme("light");
  themeButton().click();
  expectRenderedTheme("dark");

  expect(
    setItem.mock.calls
      .filter(([key]) => key === storageKey)
      .map(([, value]) => value),
  ).toEqual(["dark", "light", "dark"]);
  cleanup();
});

test.each([
  ["corrupted", true, "dark"],
  [null, false, "light"],
])(
  "stored value %s falls through to the one-time OS theme",
  (stored, matches, expected) => {
    renderThemeControls();
    if (stored !== null) localStorage.setItem(storageKey, stored);
    installMatchMedia(mediaQuery(matches));

    const cleanup = initializeThemeControls(storageKey);
    expectRenderedTheme(expected);
    expect(localStorage.getItem("tsd-theme")).toBe(expected);
    expect(localStorage.getItem(storageKey)).toBe(stored);
    cleanup();
  },
);

test("unavailable media queries use the light fallback", () => {
  renderThemeControls();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => {
      throw new Error("Media query unavailable");
    },
  });

  const cleanup = initializeThemeControls(storageKey);
  expectRenderedTheme("light");
  expect(localStorage.getItem("tsd-theme")).toBe("light");
  cleanup();
});

test("failed persistence keeps the explicitly selected session theme", () => {
  renderThemeControls();
  const media = mediaQuery(true);
  installMatchMedia(media);
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
  expectRenderedTheme("dark");
  expect(() => themeButton().click()).not.toThrow();
  expectRenderedTheme("light");
  media.change(false);
  expectRenderedTheme("light");
  cleanup();
});

test("TypeDoc Settings and navbar remain synchronized without recursive changes", () => {
  renderThemeControls({ typeDoc: true });
  const media = mediaQuery(true);
  installMatchMedia(media);
  const control = document.querySelector("#tsd-theme");
  const observedChanges = jest.fn(() => {
    document.documentElement.dataset.theme = control.value;
    localStorage.setItem("tsd-theme", control.value);
  });
  control.addEventListener("change", observedChanges);

  const cleanup = initializeThemeControls(storageKey);
  expect(control.value).toBe("dark");
  expectRenderedTheme("dark");

  control.value = "light";
  control.dispatchEvent(new Event("change", { bubbles: true }));
  expectRenderedTheme("light");
  expect(localStorage.getItem(storageKey)).toBe("light");
  expect(observedChanges).toHaveBeenCalledTimes(1);

  themeButton().click();
  expectRenderedTheme("dark");
  expect(control.value).toBe("dark");
  expect(observedChanges).toHaveBeenCalledTimes(1);
  cleanup();
});

test("unsupported TypeDoc theme values restore the last valid theme", () => {
  renderThemeControls({ typeDoc: true });
  installMatchMedia(mediaQuery(false));
  const control = document.querySelector("#tsd-theme");
  control.addEventListener("change", () => {
    document.documentElement.dataset.theme = control.value;
    localStorage.setItem("tsd-theme", control.value);
  });
  const cleanup = initializeThemeControls(storageKey);
  control.append(new Option("Unsupported", "unsupported"));
  control.value = "unsupported";
  control.dispatchEvent(new Event("change", { bubbles: true }));

  expectRenderedTheme("light");
  expect(control.value).toBe("light");
  expect(localStorage.getItem("tsd-theme")).toBe("light");
  expect(localStorage.getItem(storageKey)).toBeNull();
  cleanup();
});

test("duplicate initialization and cleanup remain safe without media listeners", () => {
  renderThemeControls();
  const media = mediaQuery(false);
  installMatchMedia(media);

  const cleanup = initializeThemeControls(storageKey);
  const duplicateCleanup = initializeThemeControls(storageKey);
  expect(media.addEventListener).not.toHaveBeenCalled();
  duplicateCleanup();
  themeButton().click();
  expectRenderedTheme("dark");
  cleanup();
  cleanup();
  themeButton().click();
  expectRenderedTheme("dark");
  expect(media.removeEventListener).not.toHaveBeenCalled();
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
