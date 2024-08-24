import {
  createSignal,
  For,
  Switch,
  Match,
  Show,
  type Component,
} from "solid-js";
import { createStore } from "solid-js/store";

import { Agent } from "@atproto/api";
import { BrowserOAuthClient, OAuthAgent } from "@atproto/oauth-client-browser";

enum RepoStatus {
  BLOCKEDBY = 1 << 0,
  BLOCKING = 1 << 1,
  DELETED = 1 << 2,
  DEACTIVATED = 1 << 3,
  SUSPENDED = 1 << 4,
  YOURSELF = 1 << 5,
}

type FollowRecord = {
  did: string;
  handle: string;
  uri: string;
  status: RepoStatus;
  toBeDeleted: boolean;
};

const [followRecords, setFollowRecords] = createStore<FollowRecord[]>([]);
const [loginState, setLoginState] = createSignal<boolean>();
const [notice, setNotice] = createSignal("");

const client = await BrowserOAuthClient.load({
  clientId: "https://cleanfollow-bsky.pages.dev/client-metadata.json",
  handleResolver: "https://boletus.us-west.host.bsky.network",
});

client.addEventListener("deleted", () => {
  setLoginState(false);
});

let appAgent: Agent;
let userHandle: string;

const result: undefined | { agent: OAuthAgent; state?: string } = await client
  .init()
  .catch(() => {});

if (result) {
  appAgent = result.agent;
  setLoginState(true);
  const res = await appAgent.getProfile({ actor: appAgent.did! });
  userHandle = res.data.handle;
}

const loginBsky = async (handle: string) => {
  setNotice("Redirecting...");
  try {
    await client.signIn(handle, {
      signal: new AbortController().signal,
    });
  } catch (err) {
    setNotice("Error during OAuth redirection");
  }
};

const logoutBsky = async () => {
  if (result) await client.revoke(result.agent.sub);
};

const Follows: Component = () => {
  function selectRecords(status: RepoStatus, toBeDeleted: boolean) {
    followRecords.forEach((record, index) => {
      if (record.status & status)
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
              class="h-4 w-4 rounded border-gray-400 text-indigo-600 focus:ring-indigo-600"
              onChange={(e) =>
                selectRecords(RepoStatus.DELETED, e.currentTarget.checked)
              }
            />
            <label for="deleted" class="ml-2 select-none">
              Deleted
            </label>
          </div>
          <div class="flex h-6 items-center">
            <input
              type="checkbox"
              id="deactivated"
              class="h-4 w-4 rounded border-gray-400 text-indigo-600 focus:ring-indigo-600"
              onChange={(e) =>
                selectRecords(RepoStatus.DEACTIVATED, e.currentTarget.checked)
              }
            />
            <label for="deactivated" class="ml-2 select-none">
              Deactivated
            </label>
          </div>
          <div class="flex h-6 items-center">
            <input
              type="checkbox"
              id="suspended"
              class="h-4 w-4 rounded border-gray-400 text-indigo-600 focus:ring-indigo-600"
              onChange={(e) =>
                selectRecords(RepoStatus.SUSPENDED, e.currentTarget.checked)
              }
            />
            <label for="suspended" class="ml-2 select-none">
              Suspended
            </label>
          </div>
          <div class="flex h-6 items-center">
            <input
              type="checkbox"
              id="blockedby"
              class="h-4 w-4 rounded border-gray-400 text-indigo-600 focus:ring-indigo-600"
              onChange={(e) =>
                selectRecords(RepoStatus.BLOCKEDBY, e.currentTarget.checked)
              }
            />
            <label for="blockedby" class="ml-2 select-none">
              Blocked By
            </label>
          </div>
          <div class="flex h-6 items-center">
            <input
              type="checkbox"
              id="blocking"
              class="h-4 w-4 rounded border-gray-400 text-indigo-600 focus:ring-indigo-600"
              onChange={(e) =>
                selectRecords(RepoStatus.BLOCKING, e.currentTarget.checked)
              }
            />
            <label for="blocking" class="ml-2 select-none">
              Blocking
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
                  class="h-4 w-4 rounded border-gray-400 text-indigo-600 focus:ring-indigo-600"
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
                <label for={"record" + index()} class="flex flex-col">
                  <span>@{record.handle}</span>
                  <span>{record.did}</span>
                  <span>
                    <Switch>
                      <Match
                        when={
                          record.status ==
                          (RepoStatus.BLOCKEDBY | RepoStatus.BLOCKING)
                        }
                      >
                        Mutual Block
                      </Match>
                      <Match when={record.status == RepoStatus.DELETED}>
                        Deleted
                      </Match>
                      <Match when={record.status == RepoStatus.DEACTIVATED}>
                        Deactivated
                      </Match>
                      <Match when={record.status == RepoStatus.BLOCKEDBY}>
                        Blocked by
                      </Match>
                      <Match when={record.status == RepoStatus.BLOCKING}>
                        Blocking
                      </Match>
                      <Match when={record.status == RepoStatus.SUSPENDED}>
                        Suspended
                      </Match>
                      <Match when={record.status == RepoStatus.YOURSELF}>
                        Literally Yourself
                      </Match>
                    </Switch>
                  </span>
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
  const [loginInput, setLoginInput] = createSignal("");
  const [progress, setProgress] = createSignal(0);
  const [followCount, setFollowCount] = createSignal(0);

  const fetchHiddenAccounts = async () => {
    const fetchFollows = async () => {
      const PAGE_LIMIT = 100;
      const fetchPage = async (cursor?: any) => {
        return await appAgent.com.atproto.repo.listRecords({
          repo: appAgent.did!,
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

    setNotice("");
    setProgress(0);

    await fetchFollows().then((follows) =>
      follows.forEach(async (record: any) => {
        setFollowCount(follows.length);

        try {
          const res = await appAgent.getProfile({
            actor: record.value.subject,
          });
          if (res.data.viewer?.blockedBy) {
            const status =
              res.data.viewer?.blocking || res.data.viewer?.blockingByList
                ? RepoStatus.BLOCKEDBY | RepoStatus.BLOCKING
                : RepoStatus.BLOCKEDBY;
            setFollowRecords(followRecords.length, {
              did: record.value.subject,
              handle: res.data.handle,
              uri: record.uri,
              status: status,
              toBeDeleted: false,
            });
          } else if (res.data.did.includes(appAgent.did!)) {
            setFollowRecords(followRecords.length, {
              did: record.value.subject,
              handle: res.data.handle,
              uri: record.uri,
              status: RepoStatus.YOURSELF,
              toBeDeleted: false,
            });
          } else if (
            res.data.viewer?.blocking ||
            res.data.viewer?.blockingByList
          ) {
            setFollowRecords(followRecords.length, {
              did: record.value.subject,
              handle: res.data.handle,
              uri: record.uri,
              status: RepoStatus.BLOCKING,
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

          const status = e.message.includes("not found")
            ? RepoStatus.DELETED
            : e.message.includes("deactivated")
              ? RepoStatus.DEACTIVATED
              : e.message.includes("suspended")
                ? RepoStatus.SUSPENDED
                : undefined;

          const handle = await res.json().then((doc) => {
            for (const alias of doc.alsoKnownAs) {
              if (alias.includes("at://")) {
                return alias.split("//")[1];
              }
            }
          });

          if (status !== undefined) {
            setFollowRecords(followRecords.length, {
              did: record.value.subject,
              handle: handle,
              uri: record.uri,
              status: status,
              toBeDeleted: false,
            });
          }
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
    for (let i = 0; i < writes.length; i += BATCHSIZE) {
      await appAgent.com.atproto.repo.applyWrites({
        repo: appAgent.did!,
        writes: writes.slice(i, i + BATCHSIZE),
      });
    }

    setFollowRecords([]);
    setProgress(0);
    setFollowCount(0);
    setNotice(`Unfollowed ${writes.length} accounts`);
  };

  return (
    <div class="flex flex-col items-center">
      <div class="flex flex-col items-center">
        <Show when={!loginState()}>
          <label for="handle">Handle:</label>
          <input
            type="text"
            id="handle"
            placeholder="user.bsky.social"
            class="rounded-md mt-1 py-1 pl-2 pr-2 mb-3 ring-1 ring-inset ring-gray-300"
            onInput={(e) => setLoginInput(e.currentTarget.value)}
          />
          <button
            type="button"
            onclick={() => loginBsky(loginInput())}
            class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Login
          </button>
        </Show>
        <Show when={loginState()}>
          <div class="mb-5">
            Logged in as {userHandle} (
            <a href="" class="text-red-600" onclick={() => logoutBsky()}>
              Logout
            </a>
            )
          </div>
          <Show when={!followRecords.length}>
            <button
              type="button"
              onclick={() => fetchHiddenAccounts()}
              class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Preview
            </button>
          </Show>
          <Show when={followRecords.length}>
            <button
              type="button"
              onclick={() => unfollow()}
              class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              Confirm
            </button>
          </Show>
        </Show>
      </div>
      <Show when={notice()}>
        <div class="m-3">{notice()}</div>
      </Show>
      <Show when={loginState() && followCount()}>
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
      <div class="mb-3 text-center">
        <p>Unfollow blocked, deleted, suspended, and deactivated accounts</p>
        <p>By default, every account will be unselected</p>
        <div>
          <a
            class="text-blue-600 hover:underline"
            href="https://github.com/notjuliet/cleanfollow-bsky"
          >
            Source Code
          </a>
          <span> | </span>
          <a
            class="text-blue-600 hover:underline"
            href="https://bsky.app/profile/adorable.mom"
          >
            Bluesky
          </a>
          <span> | </span>
          <a
            class="text-blue-600 hover:underline"
            href="https://mary-ext.codeberg.page/bluesky-quiet-posters/"
          >
            Quiet Posters
          </a>
        </div>
      </div>
      <Form />
      <Show when={loginState()}>
        <Follows />
      </Show>
    </div>
  );
};

export default App;
