import { createSignal, onMount, Show } from "solid-js";
import type { Session } from "@atcute/oauth-browser-client";
import {
  createAuthorizationUrl,
  finalizeAuthorization,
  getSession,
  OAuthUserAgent,
  resolveFromIdentity
} from "@atcute/oauth-browser-client";
import { At } from "@atcute/client/lexicons";
import { CredentialManager, XRPC } from "@atcute/client";
import { resolveDid } from "../utils/ResolveDid.tsx";

export function Login(props) {
  const [loginInput, setLoginInput] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [handle, setHandle] = createSignal("");
  const [notice, setNotice] = createSignal("");

  onMount(async () => {
    setNotice("Loading...");

    const init = async (): Promise<Session | undefined> => {
      const params = new URLSearchParams(location.hash.slice(1));

      if (params.has("state") && (params.has("code") || params.has("error"))) {
        history.replaceState(null, "", location.pathname + location.search);

        const session = await finalizeAuthorization(params);
        const did = session.info.sub;

        localStorage.setItem("lastSignedIn", did);
        return session;
      } else {
        const lastSignedIn = localStorage.getItem("lastSignedIn");

        if (lastSignedIn) {
          try {
            return await getSession(lastSignedIn as At.DID);
          } catch (err) {
            localStorage.removeItem("lastSignedIn");
            throw err;
          }
        }
      }
    };

    const session = await init().catch(() => {});

    if (session) {
      let agent = new OAuthUserAgent(session);
      props.setAgent(agent);
      props.setRpc(new XRPC({ handler: agent }));
      props.setAgentDid(agent.sub);
      props.setLoginState(true);
      setHandle(await resolveDid(agent.sub));
    }

    setNotice("");
  });

  const getPDS = async (did: string) => {
    const res = await fetch(
      did.startsWith("did:web") ?
        `https://${did.split(":")[2]}/.well-known/did.json`
        : "https://plc.directory/" + did,
    );

    return res.json().then((doc: any) => {
      for (const service of doc.service) {
        if (service.id === "#atproto_pds") return service.serviceEndpoint;
      }
    });
  };

  const resolveHandle = async (handle: string) => {
    const rpc = new XRPC({
      handler: new CredentialManager({
        service: "https://public.api.bsky.app",
      }),
    });
    const res = await rpc.get("com.atproto.identity.resolveHandle", {
      params: { handle: handle },
    });
    return res.data.did;
  };

  const loginBsky = async (login: string) => {
    if (password()) {
      let agentDID = login.startsWith("did:") ? login : await resolveHandle(login);
      let manager = new CredentialManager({ service: await getPDS(agentDID) });
      props.setAgentDid(agentDID);
      props.setRpc(new XRPC({ handler: manager }));

      await manager.login({
        identifier: agentDID,
        password: password(),
      });
      props.setLoginState(true);
    } else {
      try {
        setNotice(`Resolving your identity...`);
        const resolved = await resolveFromIdentity(login);

        setNotice(`Contacting your data server...`);
        const authUrl = await createAuthorizationUrl({
          scope: import.meta.env.VITE_OAUTH_SCOPE,
          ...resolved,
        });

        setNotice(`Redirecting...`);
        await new Promise((resolve) => setTimeout(resolve, 250));

        location.assign(authUrl);
      } catch {
        setNotice("Error during OAuth login");
      }
    }
  };

  const logoutBsky = async () => {
    await props.agent.signOut();
    props.setLoginState(false);
  };

  return (
    <div class="flex flex-col items-center">
      <Show when={!props.loginState() && !notice().includes("Loading")}>
        <form class="flex flex-col" onsubmit={(e) => e.preventDefault()}>
          <label for="handle" class="ml-0.5">
            Handle
          </label>
          <input
            type="text"
            id="handle"
            placeholder="user.bsky.social"
            class="dark:bg-dark-100 mb-2 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
            onInput={(e) => setLoginInput(e.currentTarget.value)}
          />
          <label for="password" class="ml-0.5">
            App Password
          </label>
          <input
            type="password"
            id="password"
            placeholder="leave empty for oauth"
            class="dark:bg-dark-100 mb-2 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
          <button
            onclick={() => loginBsky(loginInput())}
            class="rounded bg-blue-600 py-1.5 font-bold text-slate-100 hover:bg-blue-700"
          >
            Login
          </button>
        </form>
      </Show>
      <Show when={props.loginState() && handle()}>
        <div class="mb-4">
          Logged in as @{handle()}
          <button
            class="ml-2 bg-transparent text-red-500 dark:text-red-400"
            onclick={() => logoutBsky()}
          >
            Logout
          </button>
        </div>
      </Show>
      <Show when={notice()}>
        <div class="m-3">{notice()}</div>
      </Show>
    </div>
  );
}