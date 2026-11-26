// src/components/ui/BrokenMark.tsx - the mark laid over a picture that will not arrive.
//
// One glyph for every case, because from here a picture that came back with a failure and a network
// that has not answered in a while look the same: the mark says "it is not here" and nothing more.
// What differs is what is said beside it. Under a gallery's verdict about X the words name the host
// and, when the browser itself is the one refusing, what to do about it. On its own the words say
// only that this picture did not load.

import { For, Show } from "solid-js";
import { QuestionCircleOutlined } from "@ant-design/icons-svg";
import { tr } from "../../i18n";
import type { XStopped } from "../../stores/xReachStore";
import { AntIcon } from "./AntIcon";

export function BrokenMark(props: {
  size?: string;
  /** Which verdict this mark stands for: a gallery's about X, or this picture's own failure. */
  why?: XStopped;
  /** Show the words as visible text, for the space a picture would have filled. */
  withReason?: boolean;
}) {
  const lines = (): string[] =>
    props.why === "refused"
      ? [
          tr("picture.xRefused"),
          tr("picture.xRefusedNote"),
          tr("picture.xRefusedFix"),
        ]
      : props.why === "silent"
        ? [tr("picture.xBlocked"), tr("picture.xBlockedNote")]
        : [tr("picture.missing")];
  return (
    <Show
      when={props.withReason}
      fallback={
        // The words go in `aria-label`, for a user who is told about the page.
        <span
          role="img"
          aria-label={lines()[0]}
          title={lines()[0]}
          class="flex h-full w-full items-center justify-center"
        >
          <AntIcon
            icon={QuestionCircleOutlined}
            class="text-muted"
            size={props.size ?? "1.5rem"}
          />
        </span>
      }
    >
      <div class="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center">
        <AntIcon icon={QuestionCircleOutlined} class="text-muted" size="2rem" />
        <div class="flex flex-col gap-0.5">
          <For each={lines()}>
            {(line) => (
              <span class="block max-w-[300px] text-[13px] leading-snug text-muted">
                {line}
              </span>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}
