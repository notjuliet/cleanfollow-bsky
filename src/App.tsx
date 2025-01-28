import {
  type Component,
  createEffect,
  createSignal,
  For,
  onMount,
  Show,
} from "solid-js";
import { createStore } from "solid-js/store";

import { CredentialManager, XRPC } from "@atcute/client";
import {
  AppBskyGraphFollow,
  At,
  Brand,
  ComAtprotoRepoApplyWrites,
} from "@atcute/client/lexicons";
import {
  configureOAuth,
  createAuthorizationUrl,
  finalizeAuthorization,
  getSession,
  OAuthUserAgent,
  resolveFromIdentity,
  type Session,
} from "@atcute/oauth-browser-client";

configureOAuth({
  metadata: {
    client_id: import.meta.env.VITE_OAUTH_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URL,
  },
});

enum RepoStatus {
  BLOCKEDBY = 1 << 0,
  BLOCKING = 1 << 1,
  DELETED = 1 << 2,
  DEACTIVATED = 1 << 3,
  SUSPENDED = 1 << 4,
  HIDDEN = 1 << 5,
  YOURSELF = 1 << 6,
}

type FollowRecord = {
  did: string;
  handle: string;
  uri: string;
  status: RepoStatus;
  status_label: string;
  toDelete: boolean;
  visible: boolean;
};

const [followRecords, setFollowRecords] = createStore<FollowRecord[]>([]);
const [loginState, setLoginState] = createSignal(false);
let rpc: XRPC;
let agent: OAuthUserAgent;
let manager: CredentialManager;
let agentDID: string;

const resolveDid = async (did: string) => {
  const res = await fetch(
    did.startsWith("did:web") ?
      `https://${did.split(":")[2]}/.well-known/did.json`
    : "https://plc.directory/" + did,
  );

  return res
    .json()
    .then((doc) => {
      for (const alias of doc.alsoKnownAs) {
        if (alias.includes("at://")) {
          return alias.split("//")[1];
        }
      }
    })
    .catch(() => "");
};

const Login: Component = () => {
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
      agent = new OAuthUserAgent(session);
      rpc = new XRPC({ handler: agent });
      agentDID = agent.sub;

      setLoginState(true);
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
      agentDID = login.startsWith("did:") ? login : await resolveHandle(login);
      manager = new CredentialManager({ service: await getPDS(agentDID) });
      rpc = new XRPC({ handler: manager });

      await manager.login({
        identifier: agentDID,
        password: password(),
      });
      setLoginState(true);
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
    await agent.signOut();
    setLoginState(false);
  };

  return (
    <div class="flex flex-col items-center">
      <Show when={!loginState() && !notice().includes("Loading")}>
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
      <Show when={loginState() && handle()}>
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
};

const Fetch: Component = () => {
  const [progress, setProgress] = createSignal(0);
  const [followCount, setFollowCount] = createSignal(0);
  const [notice, setNotice] = createSignal("");

  const fetchHiddenAccounts = async () => {
    const fetchFollows = async () => {
      const PAGE_LIMIT = 100;
      const fetchPage = async (cursor?: string) => {
        return await rpc.get("com.atproto.repo.listRecords", {
          params: {
            repo: agentDID,
            collection: "app.bsky.graph.follow",
            limit: PAGE_LIMIT,
            cursor: cursor,
          },
        });
      };

      let res = await fetchPage();
      let follows = res.data.records;
      setNotice(`Fetching follows: ${follows.length}`);

      while (res.data.cursor && res.data.records.length >= PAGE_LIMIT) {
        setNotice(`Fetching follows: ${follows.length}`);
        res = await fetchPage(res.data.cursor);
        follows = follows.concat(res.data.records);
      }

      return follows;
    };

    setProgress(0);
    const follows = await fetchFollows();
    setFollowCount(follows.length);
    const tmpFollows: FollowRecord[] = [];
    setNotice("");

    const timer = (ms: number) => new Promise((res) => setTimeout(res, ms));
    for (let i = 0; i < follows.length; i = i + 10) {
      if (follows.length > 1000) await timer(1000);
      follows.slice(i, i + 10).forEach(async (record) => {
        let status: RepoStatus | undefined = undefined;
        const follow = record.value as AppBskyGraphFollow.Record;
        let handle = "";

        try {
          const res = await rpc.get("app.bsky.actor.getProfile", {
            params: { actor: follow.subject },
          });

          handle = res.data.handle;
          const viewer = res.data.viewer!;

          if (res.data.labels?.some((label) => label.val === "!hide")) {
            status = RepoStatus.HIDDEN;
          } else if (viewer.blockedBy) {
            status =
              viewer.blocking || viewer.blockingByList ?
                RepoStatus.BLOCKEDBY | RepoStatus.BLOCKING
              : RepoStatus.BLOCKEDBY;
          } else if (res.data.did.includes(agentDID)) {
            status = RepoStatus.YOURSELF;
          } else if (viewer.blocking || viewer.blockingByList) {
            status = RepoStatus.BLOCKING;
          }
        } catch (e: any) {
          handle = await resolveDid(follow.subject);

          status =
            e.message.includes("not found") ? RepoStatus.DELETED
            : e.message.includes("deactivated") ? RepoStatus.DEACTIVATED
            : e.message.includes("suspended") ? RepoStatus.SUSPENDED
            : undefined;
        }

        const status_label =
          status == RepoStatus.DELETED ? "Deleted"
          : status == RepoStatus.DEACTIVATED ? "Deactivated"
          : status == RepoStatus.SUSPENDED ? "Suspended"
          : status == RepoStatus.YOURSELF ? "Literally Yourself"
          : status == RepoStatus.BLOCKING ? "Blocking"
          : status == RepoStatus.BLOCKEDBY ? "Blocked by"
          : status == RepoStatus.HIDDEN ? "Hidden by moderation service"
          : RepoStatus.BLOCKEDBY | RepoStatus.BLOCKING ? "Mutual Block"
          : "";

        if (status !== undefined) {
          tmpFollows.push({
            did: follow.subject,
            handle: handle,
            uri: record.uri,
            status: status,
            status_label: status_label,
            toDelete: false,
            visible: true,
          });
        }
        setProgress(progress() + 1);
        if (progress() === followCount()) {
          if (tmpFollows.length === 0) setNotice("No accounts to unfollow");
          setFollowRecords(tmpFollows);
          setProgress(0);
          setFollowCount(0);
        }
      });
    }
  };

  const unfollow = async () => {
    const writes = followRecords
      .filter((record) => record.toDelete)
      .map((record): Brand.Union<ComAtprotoRepoApplyWrites.Delete> => {
        return {
          $type: "com.atproto.repo.applyWrites#delete",
          collection: "app.bsky.graph.follow",
          rkey: record.uri.split("/").pop()!,
        };
      });

    const BATCHSIZE = 200;
    for (let i = 0; i < writes.length; i += BATCHSIZE) {
      await rpc.call("com.atproto.repo.applyWrites", {
        data: {
          repo: agentDID,
          writes: writes.slice(i, i + BATCHSIZE),
        },
      });
    }

    setFollowRecords([]);
    setNotice(
      `Unfollowed ${writes.length} account${writes.length > 1 ? "s" : ""}`,
    );
  };

  return (
    <div class="flex flex-col items-center">
      <Show when={followCount() === 0 && !followRecords.length}>
        <button
          type="button"
          onclick={() => fetchHiddenAccounts()}
          class="rounded bg-blue-600 px-2 py-2 font-bold text-slate-100 hover:bg-blue-700"
        >
          Preview
        </button>
      </Show>
      <Show when={followRecords.length}>
        <button
          type="button"
          onclick={() => unfollow()}
          class="rounded bg-blue-600 px-2 py-2 font-bold text-slate-100 hover:bg-blue-700"
        >
          Confirm
        </button>
      </Show>
      <Show when={notice()}>
        <div class="m-3">{notice()}</div>
      </Show>
      <Show when={followCount() && progress() != followCount()}>
        <div class="m-3">
          Progress: {progress()}/{followCount()}
        </div>
      </Show>
    </div>
  );
};

const Follows: Component = () => {
  const [selectedCount, setSelectedCount] = createSignal(0);

  createEffect(() => {
    setSelectedCount(followRecords.filter((record) => record.toDelete).length);
  });

  function editRecords(
    status: RepoStatus,
    field: keyof FollowRecord,
    value: boolean,
  ) {
    const range = followRecords
      .map((record, index) => {
        if (record.status & status) return index;
      })
      .filter((i) => i !== undefined);
    setFollowRecords(range, field, value);
  }

  const options: { status: RepoStatus; label: string }[] = [
    { status: RepoStatus.DELETED, label: "Deleted" },
    { status: RepoStatus.DEACTIVATED, label: "Deactivated" },
    { status: RepoStatus.SUSPENDED, label: "Suspended" },
    { status: RepoStatus.BLOCKEDBY, label: "Blocked By" },
    { status: RepoStatus.BLOCKING, label: "Blocking" },
    { status: RepoStatus.HIDDEN, label: "Hidden" },
  ];

  return (
    <div class="mt-6 flex flex-col sm:w-full sm:flex-row sm:justify-center">
      <div class="dark:bg-dark-500 sticky top-0 mb-3 mr-5 flex w-full flex-wrap justify-around border-b border-b-gray-400 bg-slate-100 pb-3 sm:top-3 sm:mb-0 sm:w-auto sm:flex-col sm:self-start sm:border-none">
        <For each={options}>
          {(option, index) => (
            <div
              classList={{
                "sm:pb-2 min-w-36 sm:mb-2 mt-3 sm:mt-0": true,
                "sm:border-b sm:border-b-gray-300 dark:sm:border-b-gray-500":
                  index() < options.length - 1,
              }}
            >
              <div>
                <label class="mb-2 mt-1 inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    class="peer sr-only"
                    checked
                    onChange={(e) =>
                      editRecords(
                        option.status,
                        "visible",
                        e.currentTarget.checked,
                      )
                    }
                  />
                  <span class="peer relative h-5 w-9 rounded-full bg-gray-200 after:absolute after:start-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rtl:peer-checked:after:-translate-x-full dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-blue-800"></span>
                  <span class="ms-3 select-none">{option.label}</span>
                </label>
              </div>
              <div class="flex items-center">
                <input
                  type="checkbox"
                  id={option.label}
                  class="h-4 w-4 rounded"
                  onChange={(e) =>
                    editRecords(
                      option.status,
                      "toDelete",
                      e.currentTarget.checked,
                    )
                  }
                />
                <label for={option.label} class="ml-2 select-none">
                  Select All
                </label>
              </div>
            </div>
          )}
        </For>
        <div class="min-w-36 pt-3 sm:pt-0">
          <span>
            Selected: {selectedCount()}/{followRecords.length}
          </span>
        </div>
      </div>
      <div class="sm:min-w-96">
        <For each={followRecords}>
          {(record, index) => (
            <Show when={record.visible}>
              <div
                classList={{
                  "mb-1 flex items-center border-b dark:border-b-gray-500 py-1":
                    true,
                  "bg-red-300 dark:bg-rose-800": record.toDelete,
                }}
              >
                <div class="mx-2">
                  <input
                    type="checkbox"
                    id={"record" + index()}
                    class="h-4 w-4 rounded"
                    checked={record.toDelete}
                    onChange={(e) =>
                      setFollowRecords(
                        index(),
                        "toDelete",
                        e.currentTarget.checked,
                      )
                    }
                  />
                </div>
                <div>
                  <label for={"record" + index()} class="flex flex-col">
                    <Show when={record.handle.length}>
                      <span class="flex items-center gap-x-1">
                        @{record.handle}
                        <a
                          href={`https://bsky.app/profile/${record.did}`}
                          target="_blank"
                          class="group/tooltip relative flex items-center"
                        >
                          <button class="i-tabler-external-link text-sm text-blue-500 dark:text-blue-400" />
                          <span class="left-50% dark:bg-dark-600 pointer-events-none absolute top-5 z-10 hidden w-[14ch] -translate-x-1/2 rounded border border-neutral-500 bg-slate-200 p-1 text-center text-xs group-hover/tooltip:block">
                            Bluesky profile
                          </span>
                        </a>
                      </span>
                    </Show>
                    <span class="flex items-center gap-x-1">
                      {record.did}
                      <a
                        href={
                          record.did.startsWith("did:plc:") ?
                            `https://web.plc.directory/did/${record.did}`
                          : `https://${record.did.replace("did:web:", "")}/.well-known/did.json`
                        }
                        target="_blank"
                        class="group/tooltip relative flex items-center"
                      >
                        <button class="i-tabler-external-link text-sm text-blue-500 dark:text-blue-400" />
                        <span class="left-50% dark:bg-dark-600 pointer-events-none absolute top-5 z-10 hidden w-[14ch] -translate-x-1/2 rounded border border-neutral-500 bg-slate-200 p-1 text-center text-xs group-hover/tooltip:block">
                          DID document
                        </span>
                      </a>
                    </span>
                    <span>{record.status_label}</span>
                  </label>
                </div>
              </div>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
};

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
      <div class="mb-2 flex w-[20rem] items-center">
        <div class="basis-1/3">
          <div
            class="w-fit cursor-pointer"
            title="Theme"
            onclick={() => {
              setTheme(theme() === "light" ? "dark" : "light");
              if (theme() === "dark")
                document.documentElement.classList.add("dark");
              else document.documentElement.classList.remove("dark");
              localStorage.theme = theme();
            }}
          >
            {theme() === "dark" ?
              <div class="i-tabler-moon-stars text-xl" />
            : <div class="i-tabler-sun text-xl" />}
          </div>
        </div>
        <div class="basis-1/3 text-center text-xl font-bold">
          <a href="" class="hover:underline">
            cleanfollow
          </a>
        </div>
        <div class="justify-right flex basis-1/3 gap-x-2">
          <a
            title="Bluesky"
            href="https://bsky.app/profile/did:plc:b3pn34agqqchkaf75v7h43dk"
            target="_blank"
          >
            <button class="i-fa6-brands-bluesky text-xl" />
          </a>
          <a
            title="GitHub"
            href="https://github.com/notjuliet/cleanfollow-bsky"
            target="_blank"
          >
            <button class="i-bi-github text-xl" />
          </a>
        </div>
      </div>
      <div class="mb-2 text-center">
        <p>Select inactive or blocked accounts to unfollow</p>
      </div>
      <Login />
      <Show when={loginState()}>
        <Fetch />
        <Show when={followRecords.length}>
          <Follows />
        </Show>
      </Show>
    </div>
  );
};

export default App;
