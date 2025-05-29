import { createSignal, Show } from "solid-js";
import FollowRecord from "../types/FollowRecord.tsx";
import { RepoStatus } from "../enums/RepoStatus.tsx";
import { AppBskyGraphFollow, Brand, ComAtprotoRepoApplyWrites } from "@atcute/client/lexicons";

export function Fetch(props) {
  const [progress, setProgress] = createSignal(0);
  const [followCount, setFollowCount] = createSignal(0);
  const [notice, setNotice] = createSignal("");
  const resolveDid = async (did: string) => {
    const res = await fetch(
      did.startsWith("did:web") ?
        `https://${did.split(":")[2]}/.well-known/did.json`
        : "https://plc.directory/" + did,
    ).catch((error: unknown) => {
      console.warn("Failed to resolve DID", { error, did });
    });
    if (!res) return "";

    return res
      .json()
      .then((doc) => {
        for (const alias of doc.alsoKnownAs) {
          if (alias.includes("at://")) {
            return alias.split("//")[1];
          }
        }
      })
      .catch((error: unknown) => {
        console.warn("Failed to parse DID", { error, did });
        return "";
      });
  };

  const fetchHiddenAccounts = async () => {
    const fetchFollows = async () => {
      const PAGE_LIMIT = 100;
      const fetchPage = async (cursor?: string) => {
        return await props.rpc.get("com.atproto.repo.listRecords", {
          params: {
            repo: props.agentDid,
            collection: "app.bsky.graph.follow",
            limit: PAGE_LIMIT,
            cursor: cursor,
          },
        });
      };

      let res = await fetchPage();
      let follows = res.data.records;
      setNotice(`Fetching follows: ${follows.length}`);

      while (res.data.cursor && res.data.records.length >= PAGE_LIMIT) {
        setNotice(`Fetching follows: ${follows.length}`);
        res = await fetchPage(res.data.cursor);
        follows = follows.concat(res.data.records);
      }

      return follows;
    };

    setProgress(0);
    const follows = await fetchFollows();
    setFollowCount(follows.length);
    const tmpFollows: FollowRecord[] = [];
    setNotice("");

    const timer = (ms: number) => new Promise((res) => setTimeout(res, ms));
    for (let i = 0; i < follows.length; i = i + 10) {
      if (follows.length > 1000) await timer(1000);
      follows.slice(i, i + 10).forEach(async (record) => {
        let status: RepoStatus | undefined = undefined;
        const follow = record.value as AppBskyGraphFollow.Record;
        let handle: string;

        try {
          const res = await props.rpc.get("app.bsky.actor.getProfile", {
            params: { actor: follow.subject },
          });

          handle = res.data.handle;

          const viewer = res.data.viewer!;
          if (res.data.labels?.some((label) => label.val === "!hide")) {
            status = RepoStatus.HIDDEN;
          } else if (viewer.blockedBy) {
            status =
              viewer.blocking || viewer.blockingByList ?
                RepoStatus.BLOCKEDBY | RepoStatus.BLOCKING
                : RepoStatus.BLOCKEDBY;
          } else if (res.data.did.includes(props.agentDid)) {
            status = RepoStatus.YOURSELF;
          } else if (viewer.blocking || viewer.blockingByList) {
            status = RepoStatus.BLOCKING;
          }
        } catch (e: any) {
          handle = await resolveDid(follow.subject);

          status =
            e.message.includes("not found") ? RepoStatus.DELETED
              : e.message.includes("deactivated") ? RepoStatus.DEACTIVATED
                : e.message.includes("suspended") ? RepoStatus.SUSPENDED
                  : undefined;
        }

        const status_label =
          status == RepoStatus.DELETED ? "Deleted"
            : status == RepoStatus.DEACTIVATED ? "Deactivated"
              : status == RepoStatus.SUSPENDED ? "Suspended"
                : status == RepoStatus.YOURSELF ? "Literally Yourself"
                  : status == RepoStatus.BLOCKING ? "Blocking"
                    : status == RepoStatus.BLOCKEDBY ? "Blocked by"
                      : status == RepoStatus.HIDDEN ? "Hidden by moderation service"
                        : RepoStatus.BLOCKEDBY | RepoStatus.BLOCKING ? "Mutual Block"
                          : "";

        if (status !== undefined) {
          tmpFollows.push({
            did: follow.subject,
            handle: handle,
            uri: record.uri,
            status: status,
            status_label: status_label,
            toDelete: false,
            visible: true,
          });
        }
        setProgress(progress() + 1);
        if (progress() === followCount()) {
          if (tmpFollows.length === 0) setNotice("No accounts to unfollow");
          props.setFollowRecords(tmpFollows);
          setProgress(0);
          setFollowCount(0);
        }
      });
    }
  };

  const unfollow = async () => {
    const writes = props.followRecords
      .filter((record) => record.toDelete)
      .map((record): Brand.Union<ComAtprotoRepoApplyWrites.Delete> => {
        return {
          $type: "com.atproto.repo.applyWrites#delete",
          collection: "app.bsky.graph.follow",
          rkey: record.uri.split("/").pop()!,
        };
      });

    const BATCHSIZE = 200;
    for (let i = 0; i < writes.length; i += BATCHSIZE) {
      await props.rpc.call("com.atproto.repo.applyWrites", {
        data: {
          repo: props.agentDid,
          writes: writes.slice(i, i + BATCHSIZE),
        },
      });
    }

    props.setFollowRecords([]);
    setNotice(
      `Unfollowed ${writes.length} account${writes.length > 1 ? "s" : ""}`,
    );
  };

  return (
    <div class="flex flex-col items-center">
      <h1>Select inactive or blocked accounts to unfollow</h1>

      <Show when={followCount() === 0 && !props.followRecords.length}>
        <button
          type="button"
          onclick={() => fetchHiddenAccounts()}
          class="rounded bg-blue-600 px-2 py-2 font-bold text-slate-100 hover:bg-blue-700"
        >
          Preview
        </button>
      </Show>
      <Show when={props.followRecords.length}>
        <button
          type="button"
          onclick={() => unfollow()}
          class="rounded bg-blue-600 px-2 py-2 font-bold text-slate-100 hover:bg-blue-700"
        >
          Confirm
        </button>
      </Show>
      <Show when={notice()}>
        <div class="m-3">{notice()}</div>
      </Show>
      <Show when={followCount() && progress() != followCount()}>
        <div class="m-3">
          Progress: {progress()}/{followCount()}
        </div>
      </Show>
    </div>
  );
}