import { createSignal, For, Show, type Component } from "solid-js";
import { createStore } from "solid-js/store";

import styles from "./App.module.css";
import { BskyAgent } from "@atproto/api";

type Form = {
  serviceURL: string;
  handle: string;
  password: string;
  blockedby: boolean;
  deleted: boolean;
  deactivated: boolean;
};

let [notices, setNotices] = createSignal<string[]>([], { equals: false });
let [progress, setProgress] = createSignal(0);
let [followCount, setFollowCount] = createSignal(0);
let followRecords: Record<string, { uri: string; toBeDeleted: boolean }> = {};

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

function updateNotices(newNotice: string) {
  let tmp: string[] = notices();
  tmp.push(newNotice);
  setNotices(tmp);
}

const unfollowBsky = async (form: Form, preview: boolean) => {
  setNotices([]);

  const agent = new BskyAgent({
    service: form.serviceURL,
  });

  try {
    await agent.login({
      identifier: form.handle,
      password: form.password,
    });
  } catch (e: any) {
    updateNotices(e.message);
    return;
  }

  if (Object.keys(followRecords).length == 0 || preview) {
    if (preview) followRecords = {};

    await fetchFollows(agent).then((res) =>
      res.forEach((x: any) => {
        followRecords[x.value.subject] = {
          uri: x.uri,
          toBeDeleted: false,
        };
      }),
    );

    setProgress(0);
    setFollowCount(Object.keys(followRecords).length);

    Object.keys(followRecords).forEach(async (did) => {
      try {
        const res = await agent.getProfile({ actor: did });
        if (res.data.viewer?.blockedBy) {
          followRecords[did].toBeDeleted = true;
          updateNotices(
            `Found account you are blocked by: ${did} (${res.data.handle})`,
          );
        }
      } catch (e: any) {
        console.log(e.message);
        if (form.deleted && e.message.includes("not found")) {
          followRecords[did].toBeDeleted = true;
          updateNotices(`Found deleted account: ${did}`);
        } else if (form.deactivated && e.message.includes("deactivated")) {
          followRecords[did].toBeDeleted = true;
          updateNotices(`Found deactivated account: ${did}`);
        }
      }
      setProgress(progress() + 1);
    });
  }

  if (!preview) {
    for (const did of Object.keys(followRecords)) {
      if (followRecords[did].toBeDeleted) {
        await agent.deleteFollow(followRecords[did].uri);
        updateNotices("Unfollowed account: " + did);
      }
    }
    followRecords = {};
  }
};

const UnfollowForm: Component = () => {
  const [formStore, setFormStore] = createStore<Form>({
    serviceURL: "https://bsky.social",
    handle: "",
    password: "",
    blockedby: true,
    deleted: true,
    deactivated: false,
  });

  return (
    <div>
      <div>
        <input
          type="text"
          placeholder="https://bsky.social (optional)"
          onInput={(e) => {
            if (e.currentTarget.value)
              setFormStore("serviceURL", e.currentTarget.value);
            else setFormStore("serviceURL", "https://bsky.social");
          }}
        />
      </div>
      <div>
        <input
          type="text"
          placeholder="Handle"
          onInput={(e) => setFormStore("handle", e.currentTarget.value)}
        />
      </div>
      <div>
        <input
          type="password"
          placeholder="App Password"
          onInput={(e) => setFormStore("password", e.currentTarget.value)}
        />
      </div>
      <div>
        <input
          type="checkbox"
          id="blockedby"
          checked
          onChange={(e) => setFormStore("blockedby", e.currentTarget.checked)}
        />
        <label for="blockedby">Blocked By</label>
        <input
          type="checkbox"
          id="deleted"
          onChange={(e) => setFormStore("deleted", e.currentTarget.checked)}
          checked
        />
        <label for="deleted">Deleted</label>
        <input
          type="checkbox"
          id="deactivated"
          onChange={(e) => setFormStore("deactivated", e.currentTarget.checked)}
        />
        <label for="deactivated">Deactivated</label>
      </div>
      <button type="button" onclick={() => unfollowBsky(formStore, true)}>
        Preview
      </button>
      <button type="button" onclick={() => unfollowBsky(formStore, false)}>
        Unfollow
      </button>
    </div>
  );
};

const App: Component = () => {
  return (
    <div class={styles.App}>
      <h1>cleanfollow-bsky</h1>
      <div class={styles.Warning}>
        <p>Unfollows all blocked by, deleted, and deactivated accounts</p>
        <p>
          You can use the{" "}
          <a href="https://web.plc.directory/resolve">DID PLC Directory</a> to
          check the identity behind a DID
        </p>
        <a href="https://github.com/notjuliet/cleanfollow-bsky">Source Code</a>
      </div>
      <UnfollowForm />
      <Show when={followCount()}>
        <div>
          Progress: {progress()}/{followCount()}
        </div>
        <br />
      </Show>
      <div>
        <For each={notices()}>
          {(item) => (
            <span>
              {item}
              <br />
            </span>
          )}
        </For>
      </div>
    </div>
  );
};

export default App;
