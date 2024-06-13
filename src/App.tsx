import { createSignal, type Component } from "solid-js";

import styles from "./App.module.css";
import { BskyAgent } from "@atproto/api";

const [unfollow, setUnfollow] = createSignal("");

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

const unfollowBsky = async (userHandle: any, userPassword: any) => {
  const agent = new BskyAgent({
    service: "https://bsky.social",
  });

  await agent.login({
    identifier: userHandle,
    password: userPassword,
  });

  setUnfollow("");

  const followRecords = await fetchFollows(agent);

  let followsDID: string[] = [];
  for (let n = 0; n < followRecords.length; n++)
    followsDID[n] = followRecords[n].value.subject;

  for (let n = 0; n < followsDID.length; n = n + 25) {
    const res = await agent.getProfiles({
      actors: followsDID.slice(n, n + 25),
    });

    let tmpDID: string[] = [];
    for (let i = 0; i < res.data.profiles.length; i++) {
      tmpDID[i] = res.data.profiles[i].did;
      if (res.data.profiles[i].viewer?.blockedBy) {
        await agent.deleteFollow(followRecords[i + n].uri);
        console.log(
          "Unfollowed blocked account: " + followRecords[i + n].value.subject,
          " (" + res.data.profiles[i].handle + ")",
        );
        setUnfollow(
          unfollow() +
            "Unfollowed blocked account: " +
            followRecords[i + n].value.subject +
            " (" +
            res.data.profiles[i].handle +
            ")<br>",
        );
      }
    }
    for (let i = 0; i < res.data.profiles.length; i++) {
      if (!tmpDID.includes(followsDID[i + n])) {
        await agent.deleteFollow(followRecords[i + n].uri);
        console.log(
          "Unfollowed deleted account: " + followRecords[i + n].value.subject,
        );
        setUnfollow(
          unfollow() +
            "Unfollowed deleted account: " +
            followRecords[i + n].value.subject +
            "<br>",
        );
      }
    }
  }

  setUnfollow(unfollow() + "Done");
};

const UnfollowForm: Component = () => {
  const [userHandle, setUserHandle] = createSignal();
  const [appPassword, setAppPassword] = createSignal();

  return (
    <div>
      <form>
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
          onclick={() => unfollowBsky(userHandle(), appPassword())}
        >
          Unfollow
        </button>
      </form>
      <div innerHTML={unfollow()}></div>
    </div>
  );
};

const App: Component = () => {
  return (
    <div class={styles.App}>
      <h1>cleanfollow-bsky</h1>
      <div class="warning">
        <p>
          warning: unfollows all deleted accounts and accounts you follow that
          have blocked you
        </p>
        <p>USE AT YOUR OWN RISK</p>
      </div>
      <UnfollowForm />
    </div>
  );
};

export default App;
