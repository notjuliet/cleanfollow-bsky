import { createSignal, For, type Component } from "solid-js";
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

type followRecord = {
  uri: string;
  toBeDeleted: boolean;
};

let [notices, setNotices] = createSignal<string[]>([], { equals: false });
let followRecords: Record<string, followRecord> = {};

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
    const PROFILES_LIMIT = 25;

    for (
      let n = 0;
      n < Object.keys(followRecords).length;
      n = n + PROFILES_LIMIT
    ) {
      const res = await agent.getProfiles({
        actors: Object.keys(followRecords).slice(n, n + PROFILES_LIMIT),
      });

      if (form.blockedby) {
        res.data.profiles.forEach((x) => {
          if (x.viewer?.blockedBy) {
            followRecords[x.did].toBeDeleted = true;
            updateNotices(
              `Found account you are blocked by: ${x.did} (${x.handle})`,
            );
          }
        });
      }

      if (form.deleted || form.deactivated) {
        Object.keys(followRecords)
          .slice(n, n + PROFILES_LIMIT)
          .filter(async (did) => {
            if (!res.data.profiles.map((x) => x.did).includes(did)) {
              try {
                await agent.getProfile({ actor: did });
              } catch (e: any) {
                if (form.deleted && e.message.includes("not found")) {
                  followRecords[did].toBeDeleted = true;
                  updateNotices(`Found deleted account: ${did}`);
                } else if (
                  form.deactivated &&
                  e.message.includes(" deactivated")
                ) {
                  followRecords[did].toBeDeleted = true;
                  updateNotices(`Found deactivated account: ${did}`);
                }
              }
            }
          });
      }
    }
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

  updateNotices("Done");
};

const Notice: Component = () => {
  return (
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
  );
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
        <a href="https://github.com/notjuliet/cleanfollow-bsky">Source Code</a>
      </div>
      <UnfollowForm />
      <Notice />
    </div>
  );
};

export default App;
