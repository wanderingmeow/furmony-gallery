// The picture half of the field at the top edge: an empty drop zone, or the picture that was
// searched with its word beside it.
import { tr } from "../../i18n";
import { RemoteImg } from "../ui/RemoteImg";
import { createEffect, createSignal, on, onCleanup, Show } from "solid-js";
import type { JSX } from "solid-js";
import { PictureOutlined } from "@ant-design/icons-svg";
import {
  picture,
  type PictureState,
  type QueueState,
} from "../../stores/semanticStore";
import { type PictureError } from "../../data/searchApi";
import { AntIcon } from "../ui/AntIcon";
import { PAW_PRINT } from "../ui/icons";
import { SparkMark } from "../ui/spark";
import { CHROME_DROP_R, CHROME_PICT_STAGED } from "../ui/boxes";

/** The reason in the user's words. The *action* is not here: guessing would offer 重试 for a
 *  picture that can never be read. Typed against `PictureError` so a new reason cannot ship without
 *  its sentence; a word from a newer service falls through to the line below. */
const WHY_KEY: Record<
  PictureError,
  | "picture.unreadable"
  | "picture.heic"
  | "picture.tooBig"
  | "picture.noAnswer"
  | "picture.offline"
  | "picture.timeout"
  | "picture.failed"
> = {
  unreadable: "picture.unreadable",
  not_an_image: "picture.unreadable",
  // the file is fine and this browser has no HEVC decoder: 读不出来 would send the user elsewhere
  noHevc: "picture.heic",
  too_large: "picture.tooBig",
  embed_down: "picture.noAnswer",
  network: "picture.offline",
  timeout: "picture.timeout",
  // our own word, so it gets its own line rather than the `??` below
  unknown: "picture.failed",
};

const why = () =>
  tr(WHY_KEY[picture.error() as PictureError] ?? "picture.failed");

const ACTION_KEY = { pick: "picture.change", retry: "common.retry" } as const;

/** A chip rather than loose text: it has to be big enough for a thumb. */
function Chip(props: { onClick: () => void; children: JSX.Element }) {
  return (
    <button
      class="h-8 px-3 shrink-0 whitespace-nowrap rounded-lg border border-border bg-surface
             font-semibold text-ink
             hover:border-black/30 dark:hover:border-white/30 transition-colors"
      onClick={() => props.onClick()}
    >
      {props.children}
    </button>
  );
}

// The empty drop zone fills the row it is handed; a staged picture beside its word asks for ROW.
// draw/layout.ts sizes the field from PICTURE_INSET, so the empty box keeps the same air on all four
// sides and its corner shares the plate's centre. A row that changed height on a pointer would move
// the button under the thumb.
const ROW = 72;
const SLOT = 72;

/** A slot of its own, so the word starts in the same place for every picture, and for the same
 *  picture as it loads. */
function PreviewWithBox(props: { onClick: () => void }) {
  return (
    <div class="self-center shrink-0 w-[var(--pic-slot)] flex items-center justify-center">
      <button
        class="relative block overflow-hidden rounded-lg bg-black/5"
        onClick={() => props.onClick()}
        aria-label={tr("picture.change")}
      >
        <Show
          when={picture.preview()}
          fallback={
            <div
              class="w-[var(--pic-row)] h-[var(--pic-row)] rounded-lg border border-dashed border-black/15
                        dark:border-white/20 flex items-center justify-center"
            >
              <AntIcon icon={PictureOutlined} size={20} class="text-faint" />
            </div>
          }
        >
          <RemoteImg
            src={picture.preview()}
            class="block max-h-[var(--pic-row)] max-w-full"
          />
          {/* Where the service looked, drawn back over the picture: any sentence about what a
            model attended to would just be a claim. */}
          <Show when={picture.box()}>
            {(b) => (
              <div
                class="absolute pointer-events-none"
                style={{
                  left: `${b()[0] * 100}%`,
                  top: `${b()[1] * 100}%`,
                  width: `${b()[2] * 100}%`,
                  height: `${b()[3] * 100}%`,
                  border: "1.5px solid #fff",
                  "box-shadow": "0 0 0 1px rgba(0,0,0,.45)",
                }}
              />
            )}
          </Show>
        </Show>
      </button>
    </div>
  );
}

/** The word for each state of the queue flow. Null means the queue has nothing to report. */
const QUEUE_WORD: Record<
  QueueState,
  "picture.queued" | "picture.waiting" | null
> = {
  idle: null,
  line: "picture.queued",
  crowded: "picture.waiting",
  turn: null,
};

// `spark` sits with its word so the compiler checks both when a state is added
function stateLines(
  onPick: () => void,
): Record<PictureState, { word: () => JSX.Element; spark?: true }> {
  // for a reason this build has never heard of, a 重试 that may not help is worse than no button
  const actionLabel = () => {
    const key = ACTION_KEY[picture.action() as keyof typeof ACTION_KEY];
    return key === undefined ? "" : tr(key);
  };
  const ask = () => (picture.action() === "pick" ? onPick() : picture.search());

  return {
    empty: { word: () => <></> },
    staged: { word: () => <></> },
    // the user's own device opens the picture: no request exists yet, so neither 上传中 nor 查找中 fits
    preparing: { spark: true, word: () => <>{tr("common.loading")}</> },
    searching: {
      spark: true,
      word: () => {
        const key = picture.uploading()
          ? "picture.uploading"
          : (QUEUE_WORD[picture.queue()] ?? "picture.searching");
        return <>{tr(key)}</>;
      },
    },
    busy: { word: () => <>{tr("picture.later")}</> },
    // a control that moves is harder to hit than one extra row
    failed: {
      word: () => (
        <span class="flex flex-col items-start gap-2">
          <span>{why()}</span>
          <Show when={actionLabel()}>
            {(label) => <Chip onClick={ask}>{label()}</Chip>}
          </Show>
        </span>
      ),
    },
    // The list under the box now follows the picture, and the word says what changed its order.
    done: {
      word: () => (
        <span class="font-semibold text-ink">{tr("picture.matchTitle")}</span>
      ),
    },
    // The service found nothing alike, and 重试 would only send the same picture back.
    none: {
      word: () => (
        <span class="flex flex-col items-start gap-2">
          <span>{tr("empty.pictureNoneTitle")}</span>
          <Chip onClick={onPick}>{tr("picture.change")}</Chip>
        </span>
      ),
    },
  };
}

/** A file held over the row turns the dashed edge solid: it is already the only frame here. */
function DropZone(props: { onPick: () => void; dragging: () => boolean }) {
  return (
    <button
      class={`no-pick flex-1 min-w-0 ${CHROME_DROP_R} border-black/15 dark:border-white/20
             flex flex-col items-center justify-center gap-2.5
             hover:border-black/30 dark:hover:border-white/35 transition-colors`}
      classList={{
        "border border-dashed": !props.dragging(),
        "border-2 border-solid bg-black/5 dark:bg-white/10": props.dragging(),
      }}
      onClick={() => props.onPick()}
      title={tr("picture.dropHint")}
    >
      <AntIcon icon={PAW_PRINT} size={30} class="text-faint" />
      {/* The two lines give the box its width back: a column flex item is as wide as its own text,
          so without this the hint runs past the frame and the plate cuts it off. */}
      <span class="flex w-full min-w-0 flex-col items-center gap-0.5 px-2 text-center">
        <span class="text-sm font-semibold">{tr("picture.question")}</span>
        <span class="text-xs text-faint">{tr("picture.hint")}</span>
      </span>
    </button>
  );
}

// The paste listener sits on the window: the user copies before this row has a thing to click.
function watchPictureArrival(
  drop: () => HTMLElement | undefined,
  take: (file: Blob) => void,
) {
  const [dragging, setDragging] = createSignal(false);

  createEffect(
    on(picture.on, (shown) => {
      if (!shown) return;
      const zone = drop();
      const hand = (file: File | undefined) => {
        if (file) take(file);
      };
      // A pasted picture is usually one that the user has cut out: the ideal input.
      const onPaste = (event: ClipboardEvent) =>
        hand(event.clipboardData?.files[0]);
      const onDrop = (event: DragEvent) => {
        event.preventDefault();
        setDragging(false);
        hand(event.dataTransfer?.files[0]);
      };
      const onOver = (event: DragEvent) => {
        event.preventDefault();
        setDragging(true);
      };
      // Without this the edge stays solid after a drag that never lands.
      const onLeave = () => setDragging(false);
      window.addEventListener("paste", onPaste);
      zone?.addEventListener("drop", onDrop);
      zone?.addEventListener("dragover", onOver);
      zone?.addEventListener("dragleave", onLeave);
      onCleanup(() => {
        window.removeEventListener("paste", onPaste);
        zone?.removeEventListener("drop", onDrop);
        zone?.removeEventListener("dragover", onOver);
        zone?.removeEventListener("dragleave", onLeave);
      });
    }),
  );

  return { dragging };
}

/** The picture is on screen before any of its bytes are, and choosing it starts the search. */
export function PictureMode() {
  let input: HTMLInputElement | undefined;
  let drop: HTMLDivElement | undefined;
  const pick = () => input?.click();
  const { dragging } = watchPictureArrival(
    () => drop,
    (file) => {
      void picture.stage(file);
    },
  );
  const empty = () => picture.state() === "empty";
  const line = () => stateLines(pick)[picture.state()];

  return (
    <div
      ref={drop}
      class="flex items-stretch gap-2 w-full min-w-0"
      style={{ "--pic-row": `${ROW}px`, "--pic-slot": `${SLOT}px` }}
      classList={{ "h-[var(--pic-row)]": !empty() }}
    >
      <input
        ref={input}
        type="file"
        accept="image/*"
        class="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void picture.stage(file);
        }}
      />

      <Show
        when={empty()}
        fallback={
          <div
            class={`flex items-center gap-2 min-w-0 flex-1 ${CHROME_PICT_STAGED}`}
          >
            <PreviewWithBox onClick={pick} />
            {/* Its own item in the row, so the one gap on the row sits on both sides of the spark. */}
            <Show when={line().spark}>
              <SparkMark class="self-center" size={16} working />
            </Show>
            {/* The row stretches its children; without this the word hangs at the top of a
                tall row next to a centerd picture. */}
            <div class="self-center min-w-0 text-sm text-muted">
              {line().word()}
            </div>
          </div>
        }
      >
        <DropZone onPick={pick} dragging={dragging} />
      </Show>
    </div>
  );
}
