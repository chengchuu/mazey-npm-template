import "bootstrap/dist/css/bootstrap.min.css";
import Collapse from "bootstrap/js/dist/collapse";

import "./site.css";
import { initializeNavigation } from "./navigation";
import { initializeThemeControls } from "./theme";

initializeThemeControls();
initializeNavigation(Collapse);
