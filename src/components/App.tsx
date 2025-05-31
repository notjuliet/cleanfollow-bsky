import {
  type Component,
  createSignal,
  Show,
} from "solid-js";
import { createStore } from "solid-js/store";
import FollowRecord from "../types/FollowRecord.tsx";

import { Login } from "./Login.tsx";
import { Fetch } from "./Fetch.tsx";
import { Header } from "./Header.tsx";
import { Follows } from "./Follows.tsx";

import {
  configureOAuth,
} from "@atcute/oauth-browser-client";

configureOAuth({
  metadata: {
    client_id: import.meta.env.VITE_OAUTH_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URL,
  },
});

const [followRecords, setFollowRecords] = createStore<FollowRecord[]>([]);
const [loginState, setLoginState] = createSignal(false);
const [rpc, setRpc] = createSignal(null);
const [agent, setAgent] = createSignal(null);
const [agentDid, setAgentDid] = createSignal(null);

const App: Component = () => {
  const [theme, setTheme] = createSignal(
    (
      localStorage.theme === "dark" ||
        (!("theme" in localStorage) &&
          globalThis.matchMedia("(prefers-color-scheme: dark)").matches)
    ) ?
      "dark"
    : "light",
  );

  return (
    <div class="m-5 flex flex-col items-center text-slate-900 dark:text-slate-100">
      <Header
        theme={theme()}
        setTheme={setTheme}
      />

      <Login
        loginState={loginState}
        agent={agent}
        setLoginState={setLoginState}
        setAgent={setAgent}
        setRpc={setRpc}
        setAgentDid={setAgentDid}
      />
      <Show when={loginState()}>
        <Fetch
          agentDid={agentDid()}
          rpc={rpc()}
          followRecords={followRecords}
          setFollowRecords={setFollowRecords}

        />
        <Show when={followRecords.length}>
          <Follows
            followRecords={followRecords}
            setFollowRecords={setFollowRecords}
          />
        </Show>
      </Show>
    </div>
  );
};

export default App;
