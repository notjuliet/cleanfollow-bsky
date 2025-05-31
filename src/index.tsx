import { render } from "solid-js/web";

import App from "./components/App.tsx";
import "virtual:uno.css";
import "./styles/tailwind-compat.css";
import "./styles/icons.css"

render(() => <App />, document.getElementById("root") as HTMLElement);
