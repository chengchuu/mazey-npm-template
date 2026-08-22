/** @jest-environment jsdom */

import { jest } from "@jest/globals";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../examples/App";
import type { AppProps } from "../examples/App";
import projectConfig from "../project.config.js";
import { initializeInstallExperience } from "../site/pwa";
import { initializeThemeControls } from "../site/theme";
import { createGreeting } from "../src";

const themeStorageKey = "playground-react-test-theme";

function renderApp(props: Partial<AppProps> = {}) {
  return render(<App packageName={projectConfig.package.name} {...props} />);
}

function mediaQuery(matches = false) {
  return {
    matches,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
}

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  localStorage.clear();
  history.replaceState({}, "", "/");
  delete document.documentElement.dataset.themeControlsReady;
});

test("renders the initial greeting in an accessible live region", () => {
  renderApp();

  const result = screen.getByRole("status");
  expect(result.textContent).toBe("Hello, developer!");
  expect(result.getAttribute("aria-live")).toBe("polite");
  expect(result.getAttribute("aria-atomic")).toBe("true");
  expect(
    screen.getByRole("region", { name: "TypeScript" }).textContent,
  ).toContain(
    `import { createGreeting } from "${projectConfig.package.name}";`,
  );
});

test("keeps form controls reachable in keyboard order", async () => {
  const user = userEvent.setup();
  renderApp();

  await user.tab();
  expect(document.activeElement).toBe(
    screen.getByRole("textbox", { name: "Name" }),
  );
  await user.tab();
  expect(document.activeElement).toBe(
    screen.getByRole("combobox", { name: "Punctuation" }),
  );
  await user.tab();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Generate greeting" }),
  );
  await user.tab();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Try blank-name fallback" }),
  );
});

test("generates a greeting from controlled name and punctuation values", async () => {
  const user = userEvent.setup();
  renderApp();

  const name = screen.getByRole("textbox", { name: "Name" });
  await user.clear(name);
  await user.type(name, "React developer");
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Punctuation" }),
    ".",
  );
  await user.click(screen.getByRole("button", { name: "Generate greeting" }));

  expect(screen.getByRole("status").textContent).toBe(
    "Hello, React developer.",
  );
  expect(screen.getByRole("region", { name: "TypeScript" }).textContent)
    .toContain(`createGreeting("React developer", {
  punctuation: ".",
});`);
});

test("supports punctuation changes including no punctuation", async () => {
  const user = userEvent.setup();
  renderApp();

  const punctuation = screen.getByRole("combobox", { name: "Punctuation" });
  await user.selectOptions(punctuation, "?");
  await user.click(screen.getByRole("button", { name: "Generate greeting" }));
  expect(screen.getByRole("status").textContent).toBe("Hello, developer?");

  await user.selectOptions(punctuation, "");
  await user.click(screen.getByRole("button", { name: "Generate greeting" }));
  expect(screen.getByRole("status").textContent).toBe("Hello, developer");
});

test("demonstrates the blank-name fallback and restores input focus", async () => {
  const user = userEvent.setup();
  renderApp();

  const name = screen.getByRole("textbox", { name: "Name" });
  await user.click(
    screen.getByRole("button", { name: "Try blank-name fallback" }),
  );

  expect(name.value).toBe("   ");
  expect(document.activeElement).toBe(name);
  expect(screen.getByRole("status").textContent).toBe("Hello, friend!");
});

test("reports public API failures without discarding the last result", async () => {
  const user = userEvent.setup();
  const generateGreeting = jest.fn((name: string, options = {}) => {
    if (name === "failure") throw new Error("Example failure");
    return createGreeting(name, options);
  });
  renderApp({ generateGreeting });

  const name = screen.getByRole("textbox", { name: "Name" });
  await user.clear(name);
  await user.type(name, "failure");
  await user.click(screen.getByRole("button", { name: "Generate greeting" }));

  expect(screen.getByRole("alert").textContent).toBe(
    "The greeting could not be generated: Example failure",
  );
  expect(screen.getByRole("status").textContent).toBe("Hello, developer!");
});

test("coexists with the shared theme and PWA install controls", () => {
  const themeMedia = mediaQuery(false);
  const displayMedia = mediaQuery(false);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: jest.fn((query: string) =>
      query === "(display-mode: standalone)" ? displayMedia : themeMedia,
    ),
  });
  document.body.insertAdjacentHTML(
    "afterbegin",
    `
      <button type="button" data-theme-toggle
        aria-label="Current theme: Light. Switch to dark theme.">
        <svg data-theme-icon="light" aria-hidden="true" focusable="false"></svg>
        <svg data-theme-icon="dark" aria-hidden="true" focusable="false" hidden></svg>
      </button>
      <span data-pwa-install-container hidden>
        <button type="button" data-pwa-install hidden>Install app</button>
      </span>
      <span data-pwa-install-help>Website app help</span>
      <span data-pwa-status></span>
    `,
  );
  renderApp();

  const removeTheme = initializeThemeControls(themeStorageKey);
  fireEvent.click(
    screen.getByRole("button", {
      name: "Current theme: Light. Switch to dark theme.",
    }),
  );
  expect(document.documentElement.dataset.bsTheme).toBe("dark");

  const removeInstall = initializeInstallExperience(
    document,
    window,
    navigator,
    projectConfig.brand.displayName,
  );
  const prompt = Object.assign(
    new Event("beforeinstallprompt", { cancelable: true }),
    {
      prompt: jest.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    },
  );
  window.dispatchEvent(prompt);

  expect(screen.getByRole("button", { name: "Install app" }).hidden).toBe(
    false,
  );
  expect(
    screen.getByRole("button", { name: "Generate greeting" }),
  ).not.toBeNull();
  removeInstall();
  removeTheme();
});
