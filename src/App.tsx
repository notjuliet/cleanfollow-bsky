import { createSignal, For, Show, type Component } from "solid-js";
import { createStore } from "solid-js/store";

import styles from "./App.module.css";
import { BskyAgent } from "@atproto/api";

type Form = {
  handle: string;
  password: string;
  blockedby: boolean;
  deleted: boolean;
  deactivated: boolean;
  suspended: boolean;
};

let [notices, setNotices] = createSignal<string[]>([], { equals: false });
let [progress, setProgress] = createSignal(0);
let [followCount, setFollowCount] = createSignal(0);
let followRecords: Record<
  string,
  { handle: string; uri: string; toBeDeleted: boolean }
> = {};

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

const resolveHandle = async (handle: string) => {
  const agent = new BskyAgent({
    service: "https://public.api.bsky.app",
  });

  const res = await agent.com.atproto.identity.resolveHandle({
    handle: handle,
  });

  return res.data.did;
};

const fetchServiceEndpoint = async (handle: string) => {
  const did = await resolveHandle(handle);

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

const unfollowBsky = async (form: Form, preview: boolean) => {
  setNotices([]);

  const serviceURL = await fetchServiceEndpoint(form.handle);

  const agent = new BskyAgent({
    service: serviceURL,
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

    await fetchFollows(agent).then((follows) =>
      follows.forEach((record: any) => {
        followRecords[record.value.subject] = {
          handle: "",
          uri: record.uri,
          toBeDeleted: false,
        };
      }),
    );

    setProgress(0);
    setFollowCount(Object.keys(followRecords).length);

    Object.keys(followRecords).forEach(async (did) => {
      try {
        const res = await agent.getProfile({ actor: did });
        if (form.blockedby && res.data.viewer?.blockedBy) {
          followRecords[did].handle = res.data.handle;
          followRecords[did].toBeDeleted = true;
          updateNotices(
            `Found account you are blocked by: ${did} (${res.data.handle})`,
          );
        }
      } catch (e: any) {
        console.log(e.message);
        const res = await fetch(
          did.startsWith("did:web")
            ? "https://" + did.split(":")[2] + "/.well-known/did.json"
            : "https://plc.directory/" + did,
        );

        followRecords[did].handle = await res.json().then((doc) => {
          for (const alias of doc.alsoKnownAs) {
            if (alias.includes("at://")) {
              return alias.split("//")[1];
            }
          }
        });

        if (form.deleted && e.message.includes("not found")) {
          followRecords[did].toBeDeleted = true;
          updateNotices(
            `Found deleted account: ${did} (${followRecords[did].handle})`,
          );
        } else if (form.deactivated && e.message.includes("deactivated")) {
          followRecords[did].toBeDeleted = true;
          updateNotices(
            `Found deactivated account: ${did} (${followRecords[did].handle})`,
          );
        } else if (form.suspended && e.message.includes("suspended")) {
          followRecords[did].toBeDeleted = true;
          updateNotices(
            `Found suspended account: ${did} (${followRecords[did].handle})`,
          );
        }
      }
      setProgress(progress() + 1);
    });
  }

  if (!preview) {
    setFollowCount(0);

    const unfollowCount = Object.values(followRecords).filter(
      (record) => record.toBeDeleted,
    ).length;

    const writes = Object.values(followRecords)
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

    setNotices([`Unfollowed ${unfollowCount} accounts.`]);
    followRecords = {};
  }
};

const UnfollowForm: Component = () => {
  const [formStore, setFormStore] = createStore<Form>({
    handle: "",
    password: "",
    blockedby: true,
    deleted: true,
    deactivated: false,
    suspended: false,
  });

  return (
    <div>
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
        <input
          type="checkbox"
          id="suspended"
          onChange={(e) => setFormStore("suspended", e.currentTarget.checked)}
        />
        <label for="suspended">Suspended</label>
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
