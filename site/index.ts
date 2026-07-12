const copyButton = document.querySelector<HTMLButtonElement>(
  "[data-copy-install]",
);
const copyStatus = document.querySelector<HTMLElement>("[data-copy-status]");

copyButton?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText("npm install mazey-npm-template");
    if (copyStatus) copyStatus.textContent = "Install command copied.";
  } catch {
    if (copyStatus)
      copyStatus.textContent =
        "Copy was unavailable. Select the install command manually.";
  }
});
