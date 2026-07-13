import "./api.css";
import { SITE_PWA_CONFIG } from "./pwa-config";
import { initializeSitePwa } from "./pwa";
import { initializeThemeControls } from "./theme";

initializeThemeControls();
initializeSitePwa(SITE_PWA_CONFIG);
