/* @refresh reload */
import { render } from "solid-js/web";

import "./index.css";
import App from "./App";
import "virtual:uno.css";
import "@unocss/reset/tailwind-compat.css";

render(() => <App />, document.getElementById("root") as HTMLElement);
