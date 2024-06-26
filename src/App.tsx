import { createSignal, type Component } from "solid-js";

import styles from "./App.module.css";
import { BskyAgent } from "@atproto/api";

const [unfollowNotice, setUnfollowNotice] = createSignal("");
let unfollowURIsIndexes: number[] = [];
let followRecords: any[];

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

const unfollowBsky = async (
  userHandle: any,
  userPassword: any,
  serviceURL: any,
  preview: boolean,
) => {
  setUnfollowNotice("");

  const agent = new BskyAgent({
    service: serviceURL,
  });

  await agent.login({
    identifier: userHandle,
    password: userPassword,
  });

  if (unfollowURIsIndexes.length == 0 || preview) {
    if (preview) unfollowURIsIndexes = [];
    followRecords = await fetchFollows(agent);

    let followsDID: string[] = [];
    for (let n = 0; n < followRecords.length; n++)
      followsDID[n] = followRecords[n].value.subject;

    const PROFILES_LIMIT = 25;

    for (let n = 0; n < followsDID.length; n = n + PROFILES_LIMIT) {
      const res = await agent.getProfiles({
        actors: followsDID.slice(n, n + PROFILES_LIMIT),
      });

      let tmpDID: string[] = [];
      for (let i = 0; i < res.data.profiles.length; i++) {
        tmpDID[i] = res.data.profiles[i].did;
        if (res.data.profiles[i].viewer?.blockedBy) {
          unfollowURIsIndexes.push(i + n);
          setUnfollowNotice(
            unfollowNotice() +
              "Found blocked account: " +
              followRecords[i + n].value.subject +
              " (" +
              res.data.profiles[i].handle +
              ")<br>",
          );
        }
      }
      for (let i = 0; i < res.data.profiles.length; i++) {
        if (!tmpDID.includes(followsDID[i + n])) {
          unfollowURIsIndexes.push(i + n);
          setUnfollowNotice(
            unfollowNotice() +
              "Found deleted account: " +
              followRecords[i + n].value.subject +
              "<br>",
          );
        }
      }
    }
  }

  if (!preview) {
    for (const i of unfollowURIsIndexes) {
      await agent.deleteFollow(followRecords[i].uri);
      setUnfollowNotice(
        unfollowNotice() +
          "Unfollowed account: " +
          followRecords[i].value.subject +
          "<br>",
      );
    }
    unfollowURIsIndexes = [];
    followRecords = [];
  }

  setUnfollowNotice(unfollowNotice() + "Done");
};

const UnfollowForm: Component = () => {
  const [userHandle, setUserHandle] = createSignal();
  const [appPassword, setAppPassword] = createSignal();
  const [serviceURL, setserviceURL] = createSignal("https://bsky.social");

  return (
    <div>
      <form>
        <div>
          <input
            type="text"
            placeholder="https://bsky.social (optional)"
            onInput={(e) => setserviceURL(e.currentTarget.value)}
          />
        </div>
        <div>
          <input
            type="text"
            placeholder="Handle"
            onInput={(e) => setUserHandle(e.currentTarget.value)}
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="App Password"
            onInput={(e) => setAppPassword(e.currentTarget.value)}
          />
        </div>
        <button
          type="button"
          onclick={() =>
            unfollowBsky(userHandle(), appPassword(), serviceURL(), true)
          }
        >
          Preview
        </button>
        <button
          type="button"
          onclick={() =>
            unfollowBsky(userHandle(), appPassword(), serviceURL(), false)
          }
        >
          Unfollow
        </button>
      </form>
      <div innerHTML={unfollowNotice()}></div>
    </div>
  );
};

const App: Component = () => {
  return (
    <div class={styles.App}>
      <h1>cleanfollow-bsky</h1>
      <div class={styles.Warning}>
        <p>
          Unfollows all deleted, deactivated, and blocked accounts you follow
        </p>
        <p>USE AT YOUR OWN RISK</p>
        <a href="https://github.com/notjuliet/cleanfollow-bsky">Source Code</a>
      </div>
      <UnfollowForm />
    </div>
  );
};

export default App;
