// TODO:
// - error for login
//

import {
  createSignal,
  For,
  Switch,
  Match,
  Show,
  type Component,
} from "solid-js";
import { createStore } from "solid-js/store";

import styles from "./App.module.css";
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
  setNotice("");
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
  function selectRecords(status: RepoStatus) {
    followRecords.forEach((record, index) => {
      if (record.status == status)
        setFollowRecords(
          index,
          "toBeDeleted",
          record.toBeDeleted ? false : true,
        );
    });
  }

  return (
    <div>
      <Show when={followRecords.length}>
        <div>
          <button
            type="button"
            onclick={() => selectRecords(RepoStatus.DELETED)}
          >
            Deleted
          </button>
          <button
            type="button"
            onclick={() => selectRecords(RepoStatus.DEACTIVATED)}
          >
            Deactivated
          </button>
          <button
            type="button"
            onclick={() => selectRecords(RepoStatus.BLOCKEDBY)}
          >
            Blocked By
          </button>
          <button
            type="button"
            onclick={() => selectRecords(RepoStatus.SUSPENDED)}
          >
            Suspended
          </button>
        </div>
      </Show>
      <For each={followRecords}>
        {(record, index) => (
          <div>
            <input
              type="checkbox"
              id="delete"
              checked={record.toBeDeleted}
              onChange={(e) =>
                setFollowRecords(
                  index(),
                  "toBeDeleted",
                  e.currentTarget.checked,
                )
              }
            />
            <span>{record.handle} </span>
            <span>
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
            </span>
            <span> {record.did}</span>
          </div>
        )}
      </For>
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

    await loginBsky(handle, password);
    if (!agent) return;

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
    <div>
      <div>
        <input
          type="text"
          placeholder="Handle"
          onInput={(e) => setHandle(e.currentTarget.value)}
        />
      </div>
      <div>
        <input
          type="password"
          placeholder="App Password"
          onInput={(e) => setPassword(e.currentTarget.value)}
        />
      </div>
      <Show when={!followRecords.length}>
        <button
          type="button"
          onclick={() => fetchHiddenAccounts(handle(), password())}
        >
          Preview
        </button>
      </Show>
      <Show when={followRecords.length}>
        <button type="button" onclick={() => unfollow()}>
          Confirm
        </button>
      </Show>
      <Show when={notice()}>
        <div>{notice()}</div>
      </Show>
      <Show when={followCount()}>
        <div>
          Progress: {progress()}/{followCount()}
        </div>
        <br />
      </Show>
    </div>
  );
};

const App: Component = () => {
  return (
    <div class={styles.App}>
      <h1>cleanfollow-bsky</h1>
      <div class={styles.Warning}>
        <p>
          Unfollows blocked by, deleted, suspended, and deactivated accounts
        </p>
        <a href="https://github.com/notjuliet/cleanfollow-bsky">Source Code</a>
      </div>
      <Form />
      <Follows />
    </div>
  );
};

export default App;
