import {
  createSignal,
  onMount,
  For,
  Show,
  type Component,
  createEffect,
} from "solid-js";
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
    //client = new BrowserOAuthClient({
    //  clientMetadata: undefined,
    //  handleResolver: "https://boletus.us-west.host.bsky.network",
    //});

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
  const [collections, setCollections] = createSignal<string[]>([]);
  const [notice, setNotice] = createSignal("");
  let currentCollection = "";
  const [cursor, setCursor] = createSignal<string | undefined>();

  onMount(async () => {
    const res = await agent.com.atproto.repo.describeRepo({
      repo: agent.assertDid,
    });
    setCollections(res.data.collections);
  });

  const fetchPage = async () => {
    setNotice("");

    const res = await agent.com.atproto.repo.listRecords({
      repo: agent.did!,
      collection: currentCollection,
      limit: 100,
      cursor: cursor(),
    });

    setCursor(
      res.data.cursor && res.data.records.length == 100 ?
        res.data.cursor
      : undefined,
    );

    let tmpRecords = Array.from(recordList);
    res.data.records.forEach((record: ComAtprotoRepoListRecords.Record) => {
      tmpRecords.push({
        record: JSON.stringify(record, null, 2),
        uri: record.uri,
        toDelete: false,
      });
    });
    setRecordList(tmpRecords);
  };

  const deleteRecords = async () => {
    const writes = recordList
      .filter((record) => record.toDelete)
      .map((record) => {
        return {
          $type: "com.atproto.repo.applyWrites#delete",
          collection: currentCollection,
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
    setCursor(undefined);
    setNotice(`Deleted ${writes.length} record${writes.length > 1 ? "s" : ""}`);
  };

  return (
    <div class="flex flex-col items-center space-y-1">
      <Show when={!recordList.length}>
        <For each={collections()}>
          {(collection) => (
            <div
              class="cursor-pointer text-blue-600 hover:underline"
              onclick={() => {
                currentCollection = collection;
                fetchPage();
              }}
            >
              {collection}
            </div>
          )}
        </For>
      </Show>
      <Show when={recordList.length}>
        <Show when={cursor() !== undefined}>
          <button
            type="button"
            onclick={() => fetchPage()}
            class="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
          >
            Load More
          </button>
        </Show>
        <button
          type="button"
          onclick={() => deleteRecords()}
          class="rounded bg-red-500 px-4 py-2 font-bold text-white hover:bg-red-700"
        >
          Delete
        </button>
      </Show>
      <Show when={notice()}>
        <div class="m-3">{notice()}</div>
      </Show>
    </div>
  );
};

const Records: Component = () => {
  const [subtext, setSubtext] = createSignal("");
  const [deleteToggle, setDeleteToggle] = createSignal(false);
  const [selectedCount, setSelectedCount] = createSignal(0);

  createEffect(() => {
    setSelectedCount(recordList.filter((record) => record.toDelete).length);
  });

  function editRecords() {
    const range = recordList
      .map((record, index) => {
        if (record.record.includes(subtext())) return index;
      })
      .filter((i) => i !== undefined);
    setRecordList(range, "toDelete", true);
  }

  return (
    <div class="mt-6 flex flex-col sm:w-2/3 sm:flex-row sm:justify-center">
      <div class="sticky top-0 mb-3 mr-5 flex w-full flex-wrap justify-around border-b border-b-gray-400 bg-white pb-3 sm:top-3 sm:mb-0 sm:w-auto sm:flex-col sm:self-start sm:border-none">
        <div class="mt-3 min-w-36 sm:mb-2 sm:mt-0 sm:border-b sm:border-b-gray-300 sm:pb-2">
          <div class="flex items-center">
            <button
              onclick={() =>
                setRecordList(
                  { from: 0, to: recordList.length - 1 },
                  "toDelete",
                  true,
                )
              }
              class="mb-2 me-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:outline-none focus:ring-4 focus:ring-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white dark:focus:ring-gray-700"
            >
              Select All
            </button>
            <button
              onclick={() =>
                setRecordList(
                  { from: 0, to: recordList.length - 1 },
                  "toDelete",
                  false,
                )
              }
              class="mb-2 me-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:outline-none focus:ring-4 focus:ring-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white dark:focus:ring-gray-700"
            >
              Unselect All
            </button>
          </div>
        </div>
        <div class="mt-3 min-w-36 sm:mb-2 sm:mt-0 sm:border-b sm:border-b-gray-300 sm:pb-2">
          <form
            onsubmit={(e) => {
              e.preventDefault();
              editRecords();
            }}
          >
            <label for="subtext" class="ml-2 select-none">
              Subtext:
            </label>
            <input
              type="text"
              id="subtext"
              placeholder='"$type": "app.bsky.embed.images"'
              class="mb-3 mt-1 rounded-md px-2 py-1"
              onChange={(e) => setSubtext(e.currentTarget.value)}
            />
          </form>
        </div>
        <div>
          <label class="mb-2 mt-1 inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              class="peer sr-only"
              onChange={(e) => setDeleteToggle(e.currentTarget.checked)}
            />
            <span class="peer relative h-5 w-9 rounded-full bg-gray-200 after:absolute after:start-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-blue-800 rtl:peer-checked:after:-translate-x-full"></span>
            <span class="ms-3 select-none dark:text-gray-300">Selected</span>
          </label>
        </div>
        <div>
          <span>
            {selectedCount()}/{recordList.length}
          </span>
        </div>
      </div>
      <div class="sm:min-w-96">
        <For each={recordList}>
          {(record, index) => (
            <Show when={deleteToggle() ? record.toDelete : true}>
              <div class="mb-2 flex items-center border-b pb-2">
                <div class="mr-4">
                  <input
                    type="checkbox"
                    id={"record" + index()}
                    class="h-4 w-4 rounded"
                    checked={record.toDelete}
                    onChange={(e) =>
                      setRecordList(
                        index(),
                        "toDelete",
                        e.currentTarget.checked,
                      )
                    }
                  />
                </div>
                <div classList={{ "bg-red-300": record.toDelete }}>
                  <label for={"record" + index()} class="flex flex-col">
                    <pre class="text-wrap break-all text-xs">
                      {record.record}
                    </pre>
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
