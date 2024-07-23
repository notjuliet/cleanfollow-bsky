import {
  createSignal,
  For,
  Switch,
  Match,
  Show,
  type Component,
} from "solid-js";
import { createStore } from "solid-js/store";

import { BskyAgent } from "@atproto/api";

enum RepoStatus {
  BLOCKEDBY,
  DELETED,
  DEACTIVATED,
  SUSPENDED,
}

type FollowRecord = {
  did: string;
  handle: string;
  uri: string;
  status: RepoStatus;
  toBeDeleted: boolean;
};

let [followRecords, setFollowRecords] = createStore<FollowRecord[]>([]);
let [notice, setNotice] = createSignal("");
let agent: BskyAgent;

const resolveHandle = async (handle: string) => {
  const agent = new BskyAgent({
    service: "https://public.api.bsky.app",
  });

  try {
    const res = await agent.com.atproto.identity.resolveHandle({
      handle: handle,
    });
    return res.data.did;
  } catch (e: any) {
    setNotice(e.message);
  }
};

const fetchServiceEndpoint = async (handle: string) => {
  const did = await resolveHandle(handle);
  if (!did) return;

  const res = await fetch(
    did.startsWith("did:web")
      ? "https://" + did.split(":")[2] + "/.well-known/did.json"
      : "https://plc.directory/" + did,
  );

  return await res.json().then((doc) => {
    for (const service of doc.service) {
      if (service.id.includes("#atproto_pds")) {
        return service.serviceEndpoint;
      }
    }
  });
};

const loginBsky = async (handle: string, password: string) => {
  const serviceURL = await fetchServiceEndpoint(handle);

  agent = new BskyAgent({
    service: serviceURL,
  });

  try {
    await agent.login({
      identifier: handle,
      password: password,
    });
  } catch (e: any) {
    setNotice(e.message);
  }
};

const Follows: Component = () => {
  function selectRecords(status: RepoStatus, toBeDeleted: boolean) {
    followRecords.forEach((record, index) => {
      if (record.status == status)
        setFollowRecords(index, "toBeDeleted", toBeDeleted);
    });
  }

  return (
    <div class="mt-3">
      <Show when={followRecords.length}>
        <div class="flex flex-row flex-wrap gap-x-5 gap-y-2">
          <div class="flex h-6 items-center">
            <input
              type="checkbox"
              id="deleted"
              class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
              onChange={(e) =>
                selectRecords(RepoStatus.DELETED, e.currentTarget.checked)
              }
            />
            <label for="deleted" class="ml-2">
              Deleted
            </label>
          </div>
          <div class="flex h-6 items-center">
            <input
              type="checkbox"
              id="deactivated"
              class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
              onChange={(e) =>
                selectRecords(RepoStatus.DEACTIVATED, e.currentTarget.checked)
              }
            />
            <label for="deactivated" class="ml-2">
              Deactivated
            </label>
          </div>
          <div class="flex h-6 items-center">
            <input
              type="checkbox"
              id="suspended"
              class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
              onChange={(e) =>
                selectRecords(RepoStatus.SUSPENDED, e.currentTarget.checked)
              }
            />
            <label for="suspended" class="ml-2">
              Suspended
            </label>
          </div>
          <div class="flex h-6 items-center">
            <input
              type="checkbox"
              id="blockedby"
              class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
              onChange={(e) =>
                selectRecords(RepoStatus.BLOCKEDBY, e.currentTarget.checked)
              }
            />
            <label for="blockedby" class="ml-2">
              Blocked By
            </label>
          </div>
        </div>
      </Show>
      <div class="mt-5">
        <For each={followRecords}>
          {(record, index) => (
            <div class="flex flex-row items-center border-b mb-2 pb-2">
              <div class="mr-4">
                <input
                  type="checkbox"
                  id={"record" + index()}
                  class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                  checked={record.toBeDeleted}
                  onChange={(e) =>
                    setFollowRecords(
                      index(),
                      "toBeDeleted",
                      e.currentTarget.checked,
                    )
                  }
                />
              </div>
              <div>
                <label for={"record" + index()}>
                  <div>@{record.handle} </div>
                  <div> {record.did} </div>
                  <div>
                    <Switch>
                      <Match when={record.status == RepoStatus.DELETED}>
                        Deleted
                      </Match>
                      <Match when={record.status == RepoStatus.DEACTIVATED}>
                        Deactivated
                      </Match>
                      <Match when={record.status == RepoStatus.BLOCKEDBY}>
                        Blocked by
                      </Match>
                      <Match when={record.status == RepoStatus.SUSPENDED}>
                        Suspended
                      </Match>
                    </Switch>
                  </div>
                </label>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

const Form: Component = () => {
  const [handle, setHandle] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [progress, setProgress] = createSignal(0);
  const [followCount, setFollowCount] = createSignal(0);

  const fetchHiddenAccounts = async (handle: string, password: string) => {
    const fetchFollows = async (agent: any) => {
      const PAGE_LIMIT = 100;
      const fetchPage = async (cursor?: any) => {
        return await agent.com.atproto.repo.listRecords({
          repo: agent.session.did,
          collection: "app.bsky.graph.follow",
          limit: PAGE_LIMIT,
          cursor: cursor,
        });
      };

      let res = await fetchPage();
      let follows = res.data.records;

      while (res.data.cursor && res.data.records.length >= PAGE_LIMIT) {
        res = await fetchPage(res.data.cursor);
        follows = follows.concat(res.data.records);
      }

      return follows;
    };

    setNotice("Logging in...");
    await loginBsky(handle, password);
    if (!agent) return;
    setNotice("");

    await fetchFollows(agent).then((follows) =>
      follows.forEach(async (record: any) => {
        setFollowCount(follows.length);

        try {
          const res = await agent.getProfile({ actor: record.value.subject });
          if (res.data.viewer?.blockedBy) {
            setFollowRecords(followRecords.length, {
              did: record.value.subject,
              handle: res.data.handle,
              uri: record.uri,
              status: RepoStatus.BLOCKEDBY,
              toBeDeleted: false,
            });
          }
        } catch (e: any) {
          const res = await fetch(
            record.value.subject.startsWith("did:web")
              ? "https://" +
                  record.value.subject.split(":")[2] +
                  "/.well-known/did.json"
              : "https://plc.directory/" + record.value.subject,
          );

          let status;
          if (e.message.includes("not found")) {
            status = RepoStatus.DELETED;
          } else if (e.message.includes("deactivated")) {
            status = RepoStatus.DEACTIVATED;
          } else if (e.message.includes("suspended")) {
            status = RepoStatus.SUSPENDED;
          }

          const handle = await res.json().then((doc) => {
            for (const alias of doc.alsoKnownAs) {
              if (alias.includes("at://")) {
                return alias.split("//")[1];
              }
            }
          });

          setFollowRecords(followRecords.length, {
            did: record.value.subject,
            handle: handle,
            uri: record.uri,
            status: status,
            toBeDeleted: false,
          });
        }
        setProgress(progress() + 1);
      }),
    );
  };

  const unfollow = async () => {
    const writes = followRecords
      .filter((record) => record.toBeDeleted)
      .map((record) => {
        return {
          $type: "com.atproto.repo.applyWrites#delete",
          collection: "app.bsky.graph.follow",
          rkey: record.uri.split("/").pop(),
        };
      });

    const BATCHSIZE = 200;
    if (agent.session) {
      for (let i = 0; i < writes.length; i += BATCHSIZE) {
        await agent.com.atproto.repo.applyWrites({
          repo: agent.session.did,
          writes: writes.slice(i, i + BATCHSIZE),
        });
      }
    }

    setFollowRecords([]);
    setProgress(0);
    setFollowCount(0);
    setNotice(`Unfollowed ${writes.length} accounts`);
  };

  return (
    <div class="flex flex-col items-center">
      <div class="flex flex-col items-center">
        <input
          type="text"
          placeholder="Handle"
          class="rounded-md py-1 pl-2 pr-2 mb-3 ring-1 ring-inset ring-gray-300"
          onInput={(e) => setHandle(e.currentTarget.value)}
        />
        <input
          type="password"
          placeholder="App Password"
          class="rounded-md py-1 pl-2 pr-2 mb-5 ring-1 ring-inset ring-gray-300"
          onInput={(e) => setPassword(e.currentTarget.value)}
        />
        <div>
          <Show when={!followRecords.length}>
            <button
              type="button"
              onclick={() => fetchHiddenAccounts(handle(), password())}
              class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Preview
            </button>
          </Show>
          <Show when={followRecords.length}>
            <button
              type="button"
              onclick={() => unfollow()}
              class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              Confirm
            </button>
          </Show>
        </div>
      </div>
      <Show when={notice()}>
        <div class="m-3">{notice()}</div>
      </Show>
      <Show when={followCount()}>
        <div class="m-3">
          Progress: {progress()}/{followCount()}
        </div>
      </Show>
    </div>
  );
};

const App: Component = () => {
  return (
    <div class="flex flex-col items-center m-5">
      <h1 class="text-2xl mb-5">cleanfollow-bsky</h1>
      <div class="mb-5 text-center">
        <p>
          Unfollows blocked by, deleted, suspended, and deactivated accounts
        </p>
        <div>
          <a
            class="text-blue-600 hover:underline"
            href="https://github.com/notjuliet/cleanfollow-bsky"
          >
            Source Code
          </a>
        </div>
        <div>
          <a
            class="text-blue-600 hover:underline"
            href="https://bsky.app/profile/juliet.renahlee.com"
          >
            Bluesky
          </a>
        </div>
      </div>
      <Form />
      <Follows />
    </div>
  );
};

export default App;
