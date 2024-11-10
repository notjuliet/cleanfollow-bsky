/* @refresh reload */
import { render } from "solid-js/web";

import App from "./App";
import "virtual:uno.css";
import "./tailwind-compat.css";

render(() => <App />, document.getElementById("root") as HTMLElement);
