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

enum RepoStatus {
  DELETED = "Deleted",
  DEACTIVATED = "Deactivated",
  BLOCKEDBY = "Blocked By",
}

type followRecord = {
  uri: string;
  did: string;
  status: RepoStatus;
};

let [notices, setNotices] = createSignal<string[]>([], { equals: false });
let unfollowRecords: followRecord[] = [];

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

  if (unfollowRecords.length == 0 || preview) {
    if (preview) unfollowRecords = [];

    const followRecords: followRecord[] = await fetchFollows(agent).then((x) =>
      x.map((x: any) => ({
        did: x.value.subject,
        uri: x.uri,
      })),
    );
    const PROFILES_LIMIT = 25;

    for (let n = 0; n < followRecords.length; n = n + PROFILES_LIMIT) {
      const res = await agent.getProfiles({
        actors: followRecords.slice(n, n + PROFILES_LIMIT).map((x) => x.did),
      });

      if (form.blockedby) {
        res.data.profiles.map((x, i) => {
          if (x.viewer?.blockedBy) {
            unfollowRecords.push({
              uri: followRecords[i + n].uri,
              did: x.did,
              status: RepoStatus.BLOCKEDBY,
            });
            updateNotices(
              `Found account you are blocked by: ${x.did} (${x.handle})`,
            );
          }
        });
      }

      if (form.deleted || form.deactivated) {
        followRecords
          .slice(n, n + PROFILES_LIMIT)
          .filter((record) => {
            if (!res.data.profiles.map((x) => x.did).includes(record.did)) {
              return { did: record.did, uri: record.uri };
            }
          })
          .forEach(async (record) => {
            try {
              await agent.getProfile({ actor: record.did });
            } catch (e: any) {
              if (form.deleted && e.message.includes("not found")) {
                unfollowRecords.push({
                  uri: record.uri,
                  did: record.did,
                  status: RepoStatus.DELETED,
                });
                updateNotices(`Found deleted account: ${record.did}`);
              } else if (
                form.deactivated &&
                e.message.includes(" deactivated")
              ) {
                unfollowRecords.push({
                  uri: record.uri,
                  did: record.did,
                  status: RepoStatus.DEACTIVATED,
                });
                updateNotices(`Found deactivated account: ${record.did}`);
              }
            }
          });
      }
    }
  }

  if (!preview) {
    for (const record of unfollowRecords) {
      if (
        (form.deleted && record.status == RepoStatus.DELETED) ||
        (form.deactivated && record.status == RepoStatus.DEACTIVATED) ||
        (form.blockedby && record.status == RepoStatus.BLOCKEDBY)
      ) {
        await agent.deleteFollow(record.uri);
        updateNotices("Unfollowed account: " + record.did);
      }
    }
    unfollowRecords = [];
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
