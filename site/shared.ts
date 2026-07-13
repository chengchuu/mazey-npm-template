import "bootstrap/dist/css/bootstrap.min.css";
import Collapse from "bootstrap/js/dist/collapse";

import "../images/logo-dark-circle-transparent-32x32.png";
import "../images/logo-dark-circle-transparent-200x200.png";
import "./site.css";
import { initializeNavigation } from "./navigation";
import { SITE_PWA_CONFIG } from "./pwa-config";
import { initializeSitePwa } from "./pwa";
import { initializeThemeControls } from "./theme";

initializeThemeControls();
initializeNavigation(Collapse);
initializeSitePwa(SITE_PWA_CONFIG);
