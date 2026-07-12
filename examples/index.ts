import { createGreeting, packageInfo } from "../src";

const form = document.querySelector<HTMLFormElement>("[data-greeting-form]");
const nameInput = document.querySelector<HTMLInputElement>(
  "[data-greeting-name]",
);
const punctuationInput = document.querySelector<HTMLSelectElement>(
  "[data-greeting-punctuation]",
);
const output = document.querySelector<HTMLElement>("[data-greeting-output]");
const error = document.querySelector<HTMLElement>("[data-greeting-error]");
const blankNameButton = document.querySelector<HTMLButtonElement>(
  "[data-use-blank-name]",
);
const packageName = document.querySelector<HTMLElement>("[data-package-name]");
const packageVersion = document.querySelector<HTMLElement>(
  "[data-package-version]",
);

if (packageName) packageName.textContent = packageInfo.name;
if (packageVersion) packageVersion.textContent = packageInfo.version;

function renderGreeting(): void {
  if (!nameInput || !punctuationInput || !output || !error) return;

  error.textContent = "";
  try {
    const message = createGreeting(nameInput.value, {
      punctuation: punctuationInput.value,
    });
    output.replaceChildren(
      Object.assign(document.createElement("code"), {
        textContent: message,
      }),
    );
  } catch (cause) {
    error.textContent =
      cause instanceof Error
        ? `The greeting could not be generated: ${cause.message}`
        : "The greeting could not be generated because of an unexpected error.";
  }
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  renderGreeting();
});

blankNameButton?.addEventListener("click", () => {
  if (!nameInput) return;
  nameInput.value = "   ";
  renderGreeting();
  nameInput.focus();
});
