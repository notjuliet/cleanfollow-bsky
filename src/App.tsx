import { createSignal, onMount, For, Show, type Component } from "solid-js";
import { createStore } from "solid-js/store";

import {
  Agent,
  ComAtprotoRepoApplyWrites,
  ComAtprotoRepoListRecords,
} from "@atproto/api";
import { BrowserOAuthClient } from "@atproto/oauth-client-browser";

type AtpRecord = {
  uri: string;
  record: string;
  toDelete: boolean;
};

const [recordList, setRecordList] = createStore<AtpRecord[]>([]);
const [loginState, setLoginState] = createSignal(false);
let agent: Agent;

const resolveDid = async (did: string) => {
  const res = await fetch(
    did.startsWith("did:web") ?
      `https://${did.split(":")[2]}/.well-known/did.json`
    : "https://plc.directory/" + did,
  );

  return await res.json().then((doc) => {
    for (const alias of doc.alsoKnownAs) {
      if (alias.includes("at://")) {
        return alias.split("//")[1];
      }
    }
  });
};

const Login: Component = () => {
  const [loginInput, setLoginInput] = createSignal("");
  const [handle, setHandle] = createSignal("");
  const [notice, setNotice] = createSignal("");
  let client: BrowserOAuthClient;
  let sub: string;

  onMount(async () => {
    setNotice("Loading...");
    client = await BrowserOAuthClient.load({
      clientId:
        "https://repocleaner.cleanfollow-bsky.pages.dev/client-metadata.json",
      handleResolver: "https://boletus.us-west.host.bsky.network",
    });

    client.addEventListener("deleted", () => {
      setLoginState(false);
    });
    const result = await client.init().catch(() => {});

    if (result) {
      agent = new Agent(result.session);
      setLoginState(true);
      setHandle(await resolveDid(agent.did!));
      sub = result.session.sub;
    }
    setNotice("");
  });

  const loginBsky = async (handle: string) => {
    setNotice("Redirecting...");
    try {
      await client.signIn(handle, {
        scope: "atproto transition:generic",
        signal: new AbortController().signal,
      });
    } catch (err) {
      setNotice("Error during OAuth redirection");
    }
  };

  const logoutBsky = async () => {
    if (sub) await client.revoke(sub);
  };

  return (
    <div class="flex flex-col items-center">
      <Show when={!loginState() && !notice().includes("Loading")}>
        <form
          class="flex flex-col items-center"
          onsubmit={(e) => e.preventDefault()}
        >
          <label for="handle">Handle:</label>
          <input
            type="text"
            id="handle"
            placeholder="user.bsky.social"
            class="mb-3 mt-1 rounded-md px-2 py-1"
            onInput={(e) => setLoginInput(e.currentTarget.value)}
          />
          <button
            onclick={() => loginBsky(loginInput())}
            class="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
          >
            Login
          </button>
        </form>
      </Show>
      <Show when={loginState() && handle()}>
        <div class="mb-5">
          Logged in as @{handle()} (
          <a href="" class="text-red-600" onclick={() => logoutBsky()}>
            Logout
          </a>
          )
        </div>
      </Show>
      <Show when={notice()}>
        <div class="m-3">{notice()}</div>
      </Show>
    </div>
  );
};

const Fetch: Component = () => {
  const [collection, setCollection] = createSignal("");
  const [notice, setNotice] = createSignal("");

  const fetchRecs = async () => {
    const fetchRecords = async () => {
      const PAGE_LIMIT = 100;
      const fetchPage = async (cursor?: string) => {
        return await agent.com.atproto.repo.listRecords({
          repo: agent.did!,
          collection: collection(),
          limit: PAGE_LIMIT,
          cursor: cursor,
        });
      };

      let res = await fetchPage();
      let records = res.data.records;

      while (res.data.cursor && res.data.records.length >= PAGE_LIMIT) {
        res = await fetchPage(res.data.cursor);
        records = records.concat(res.data.records);
      }

      return records;
    };

    setNotice("");

    await fetchRecords().then((records) => {
      records.forEach((record: ComAtprotoRepoListRecords.Record) => {
        setRecordList(recordList.length, {
          record: JSON.stringify(record.value, null, 2),
          uri: record.uri,
          toDelete: false,
        });
      });
    });
  };

  const deleteRecords = async () => {
    const writes = recordList
      .filter((record) => record.toDelete)
      .map((record) => {
        return {
          $type: "com.atproto.repo.applyWrites#delete",
          collection: collection(),
          rkey: record.uri.split("/").pop(),
        } as ComAtprotoRepoApplyWrites.Delete;
      });

    const BATCHSIZE = 200;
    for (let i = 0; i < writes.length; i += BATCHSIZE) {
      await agent.com.atproto.repo.applyWrites({
        repo: agent.did!,
        writes: writes.slice(i, i + BATCHSIZE),
      });
    }

    setRecordList([]);
    setNotice(`Deleted ${writes.length} record${writes.length > 1 ? "s" : ""}`);
  };

  return (
    <div class="flex flex-col items-center">
      <Show when={!recordList.length}>
        <form
          class="flex flex-col items-center"
          onsubmit={(e) => e.preventDefault()}
        >
          <label for="collection">Collection:</label>
          <input
            type="text"
            id="handle"
            placeholder="app.bsky.feed.post"
            class="mb-3 mt-1 rounded-md px-2 py-1"
            onInput={(e) => setCollection(e.currentTarget.value)}
          />
          <button
            onclick={() => fetchRecs()}
            class="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
          >
            Preview
          </button>
        </form>
      </Show>
      <Show when={recordList.length}>
        <button
          type="button"
          onclick={() => deleteRecords()}
          class="rounded bg-green-500 px-4 py-2 font-bold text-white hover:bg-green-700"
        >
          Confirm
        </button>
      </Show>
      <Show when={notice()}>
        <div class="m-3">{notice()}</div>
      </Show>
    </div>
  );
};

const Records: Component = () => {
  return (
    <div class="mt-6">
      <For each={recordList}>
        {(record, index) => (
          <div class="mb-2 flex items-center border-b pb-2">
            <div class="mr-4">
              <input
                type="checkbox"
                id={"record" + index()}
                class="h-4 w-4 rounded"
                checked={record.toDelete}
                onChange={(e) =>
                  setRecordList(index(), "toDelete", e.currentTarget.checked)
                }
              />
            </div>
            <div classList={{ "bg-red-300": record.toDelete }}>
              <label for={"record" + index()} class="flex flex-col">
                <pre class="text-wrap break-all">{record.record}</pre>
              </label>
            </div>
          </div>
        )}
      </For>
    </div>
  );
};

const App: Component = () => {
  return (
    <div class="m-5 flex flex-col items-center">
      <h1 class="mb-5 text-2xl">Repo Cleaner</h1>
      <Login />
      <Show when={loginState()}>
        <Fetch />
        <Show when={recordList.length}>
          <Records />
        </Show>
      </Show>
    </div>
  );
};

export default App;
