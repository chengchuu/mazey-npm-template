import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SITE_RUNTIME_CONFIG } from "../site/runtime-config";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("playground-root");

if (!root) throw new Error("The playground root element is missing.");

createRoot(root).render(
  <StrictMode>
    <App packageName={SITE_RUNTIME_CONFIG.packageName} />
  </StrictMode>,
);
