import { Show } from "solid-js";
import FollowRecord from "../types/FollowRecord.tsx";

interface FollowerProps {
  record?: FollowRecord
  index: number
}

export default function Follower(props: FollowerProps) {
  return (
    <div>
      <label for={"record" + props.index} class="flex flex-col">
        <Show when={props.record.handle.length}>
          <span class="flex items-center gap-x-1">
            @{props.record.handle}
            <a
              href={`https://bsky.app/profile/${props.record.did}`}
              target="_blank"
              class="group/tooltip relative flex items-center"
            >
              <button class="i-tabler-external-link text-sm text-blue-500 dark:text-blue-400" />
              <span class="left-50% dark:bg-dark-600 pointer-events-none absolute top-5 z-10 hidden w-[14ch] -translate-x-1/2 rounded border border-neutral-500 bg-slate-200 p-1 text-center text-xs group-hover/tooltip:block">
                Bluesky profile
              </span>
            </a>
          </span>
        </Show>
        <span class="flex items-center gap-x-1">
          {props.record.did}
          <a
            href={
              props.record.did.startsWith("did:plc:") ?
                `https://web.plc.directory/did/${props.record.did}`
              : `https://${props.record.did.replace("did:web:", "")}/.well-known/did.json`
            }
            target="_blank"
            class="group/tooltip relative flex items-center"
          >
            <button class="i-tabler-external-link text-sm text-blue-500 dark:text-blue-400" />
            <span class="left-50% dark:bg-dark-600 pointer-events-none absolute top-5 z-10 hidden w-[14ch] -translate-x-1/2 rounded border border-neutral-500 bg-slate-200 p-1 text-center text-xs group-hover/tooltip:block">
              DID document
            </span>
          </a>
        </span>
        <span>{props.record.status_label}</span>
      </label>
    </div>
  );
}
