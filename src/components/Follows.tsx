import { createEffect, createSignal, For, Show } from "solid-js";
import { RepoStatus } from "../enums/RepoStatus.tsx";
import FollowRecord from "../types/FollowRecord.tsx";
import Follower from "../components/Follower.tsx"

export function Follows(props) {
  const [selectedCount, setSelectedCount] = createSignal(0);

  createEffect(() => {
    setSelectedCount(props.followRecords.filter((record) => record.toDelete).length);
  });

  function editRecords(
    status: RepoStatus,
    field: keyof FollowRecord,
    value: boolean,
  ) {
    const range = props.followRecords
      .map((record, index) => {
        if (record.status && status) return index;
      })
      .filter((i) => i !== undefined);
    props.setFollowRecords(range, field, value);
  }

  const options: { status: RepoStatus; label: string }[] = [
    { status: RepoStatus.DELETED, label: "Deleted" },
    { status: RepoStatus.DEACTIVATED, label: "Deactivated" },
    { status: RepoStatus.SUSPENDED, label: "Suspended" },
    { status: RepoStatus.BLOCKEDBY, label: "Blocked By" },
    { status: RepoStatus.BLOCKING, label: "Blocking" },
    { status: RepoStatus.HIDDEN, label: "Hidden" },
  ];

  return (
    <div class="mt-6 flex flex-col sm:w-full sm:flex-row sm:justify-center">
      <div class="dark:bg-dark-500 sticky top-0 mb-3 mr-5 flex w-full flex-wrap justify-around border-b border-b-gray-400 bg-slate-100 pb-3 sm:top-3 sm:mb-0 sm:w-auto sm:flex-col sm:self-start sm:border-none">
        <For each={options}>
          {(option, index) => (
            <div
              classList={{
                "sm:pb-2 min-w-36 sm:mb-2 mt-3 sm:mt-0": true,
                "sm:border-b sm:border-b-gray-300 dark:sm:border-b-gray-500":
                  index() < options.length - 1,
              }}
            >
              <div>
                <label class="mb-2 mt-1 inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    class="peer sr-only"
                    checked
                    onChange={(e) =>
                      editRecords(
                        option.status,
                        "visible",
                        e.currentTarget.checked,
                      )
                    }
                  />
                  <span class="peer relative h-5 w-9 rounded-full bg-gray-200 after:absolute after:start-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rtl:peer-checked:after:-translate-x-full dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-blue-800"></span>
                  <span class="ms-3 select-none">{option.label}</span>
                </label>
              </div>
              <div class="flex items-center">
                <input
                  type="checkbox"
                  id={option.label}
                  class="h-4 w-4 rounded"
                  onChange={(e) =>
                    editRecords(
                      option.status,
                      "toDelete",
                      e.currentTarget.checked,
                    )
                  }
                />
                <label for={option.label} class="ml-2 select-none">
                  Select All
                </label>
              </div>
            </div>
          )}
        </For>
        <div class="min-w-36 pt-3 sm:pt-0">
          <span>
            Selected: {selectedCount()}/{props.followRecords.length}
          </span>
        </div>
      </div>
      <div class="sm:min-w-96">
        <For each={props.followRecords}>
          {(record, index) => (
            <Show when={record.visible}>
              <div
                classList={{
                  "mb-1 flex items-center border-b dark:border-b-gray-500 py-1":
                    true,
                  "bg-red-300 dark:bg-rose-800": record.toDelete,
                }}
              >
                <div class="mx-2">
                  <input
                    type="checkbox"
                    id={"record" + index()}
                    class="h-4 w-4 rounded"
                    checked={record.toDelete}
                    onChange={(e) =>
                      props.setFollowRecords(
                        index(),
                        "toDelete",
                        e.currentTarget.checked,
                      )
                    }
                  />
                </div>
                <Follower record={record} />
              </div>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
}