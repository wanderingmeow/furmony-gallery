// src/stores/semanticStore.ts - state for the enhanced search, sentence and picture.
import { tr } from "../i18n";
import {
  batch,
  createEffect,
  createMemo,
  createRoot,
  createSignal,
  on,
  onCleanup,
  untrack,
  type Accessor,
} from "solid-js";
import { createMachine } from "@solid-primitives/state-machine";
import {
  askPicture,
  askSettings,
  PICTURE_TIMEOUT_MS,
  searchConfigured,
  SEARCH_TIMEOUT_MS,
  type PictureResult,
  type QueuePhase,
  type SemanticResult,
} from "../data/searchApi";
import { outcomeOf } from "../model/pictureOutcome";
import { routeFor, shouldAskText, type Route } from "../model/queryRoute";
// Static, not lazy: a chunk here puts one more request in front of the picture the user just
// chose. The HEIF parser stays lazy, in a worker file that only a HEIC loads.
import { prepare } from "../data/pictureInput";
import { searchText } from "./filterStore";
import { semanticSearch } from "./displayStore";

// ---------- the picture ----------

/** The picture, waiting to go out, and the preview the panel shows. */
type Queued = { blob: Blob; url: string };

/** The machine the picture runs on: one state per answer to 这张图到哪一步了. The work belongs
 *  to the state that needs it - the re-encode to `preparing`, the request to `searching` - so
 *  leaving a state calls its work off rather than leaving that to a later line of code. */
type PictureFlow = {
  /** The slot holds nothing, so the drop zone is what the user sees. */
  empty: { value: null; to: "preparing" };
  /** The user's own device is re-encoding the picture. */
  preparing: {
    input: Blob;
    value: null;
    to: "searching" | "failed" | "staged" | "empty";
  };
  /** A picture is up with nothing running. */
  staged: { value: null; to: "searching" | "preparing" | "empty" };
  /** A request is running. Which half of it - the upload across the user's own network, or
   *  the service's work - is progress within one request, so it reads as `uploading` rather
   *  than as a state: there is one thing to call off, not two. `queue` is the other axis and
   *  starts over with each request. */
  searching: {
    input: Queued;
    value: { uploading: Accessor<boolean>; queue: Accessor<QueueState> };
    to: "busy" | "failed" | "none" | "done" | "staged" | "preparing" | "empty";
  };
  /** The service declined a second upload while one was in flight. */
  busy: { value: null; to: "searching" | "preparing" | "empty" };
  /** The search did not answer, or the browser could not read the file. */
  failed: { value: null; to: "searching" | "preparing" | "empty" };
  /** A complete answer with nothing similar in the collection. */
  none: { value: null; to: "searching" | "preparing" | "empty" };
  /** A complete answer with a ranking. */
  done: { value: null; to: "searching" | "preparing" | "empty" };
};

/** Where the picture stands. Adding a state to the machine makes every switch on this fail to
 *  compile until the new state is given a word and a meaning. */
export type PictureState = keyof PictureFlow;

/** Where a queued upload stands, frame by frame. `to` lists only what can really happen. */
export type QueueFlow = {
  /** Nothing has been said, so the ordinary 查找中 is the true thing to show. */
  idle: { value: null; to: "line" | "turn" };
  /** Waiting for a turn that has not come. */
  line: { value: null; to: "crowded" | "turn" };
  /** Waiting still: the service says so again while the line holds. */
  crowded: { value: null; to: "turn" };
  /** Being searched now, so there is nothing left to say about a line. */
  turn: { value: null; to: [] };
};

export type QueueState = keyof QueueFlow;

/** The table above at runtime: a phase moves the queue only where its state declares it can. */
const QUEUE_NEXT: { [S in QueueState]: readonly QueueFlow[S]["to"][] } = {
  idle: ["line", "turn"],
  line: ["crowded", "turn"],
  crowded: ["turn"],
  turn: [],
};

const QUEUE_PHASE: Record<QueuePhase, QueueState> = {
  queued: "line",
  waiting: "crowded",
  started: "turn",
};

/** The state a phase moves the queue to, or the state it was already in. */
export function queueMove(from: QueueState, phase: QueuePhase): QueueState {
  const to = QUEUE_PHASE[phase];
  return (QUEUE_NEXT[from] as readonly QueueState[]).includes(to) ? to : from;
}

/** Past this fraction of both edges the box is the picture. Drawing it would put the frame on the
 *  preview's own rounded corners, where it looks like a broken overlay. A box over one edge is a
 *  band, and a band is worth drawing. */
const BOX_IS_THE_PICTURE = 0.9;

/** The picture half of the enhanced search. Opening it is not a filter: the search box, the
 *  tabs and the sort buttons give way to one thumbnail. */
function makePictureSearch() {
  const [modeOn, setModeOn] = createSignal(false);
  const [staged, setStaged] = createSignal<Queued | null>(null);
  const [answer, setAnswer] = createSignal<PictureResult | null>(null);
  const [lastShownIds, setLastShownIds] = createSignal<number[] | null>(null);

  const flow = createMachine<PictureFlow>({
    initial: "empty",
    states: {
      empty: () => null,

      /** The encode belongs to this state, so a newer picture or 退出 retires it: the bytes
       *  that come back after the state is gone are nobody's picture. */
      preparing(file, to) {
        let alive = true;
        onCleanup(() => {
          alive = false;
        });
        void prepare(file).then((found) => {
          if (!alive) return;
          if (!found.blob) {
            // The browser could not read it: a HEIC with no platform HEVC decoder, a
            // truncated file. Nothing left the device, so the service never got to say:
            // use another picture.
            release();
            batch(() => {
              setAnswer({
                ids: [],
                box: null,
                error: found.reason,
                action: "pick",
              });
              to.failed();
            });
            return;
          }
          // From here the preview is the same picture that goes out: white ground, at most
          // 768px, orientation baked in rather than promised.
          const queued: Queued = {
            blob: found.blob,
            url: URL.createObjectURL(found.blob),
          };
          release();
          batch(() => {
            setStaged(queued);
            to.searching(queued);
          });
        });
        return null;
      },

      staged: () => null,

      /** The request belongs to this state: leaving it calls the question off and clears the
       *  timeout that would have called it off, so a replaced upload cannot hold the service's
       *  single slot. */
      searching(pic, to) {
        const [uploading, setUploading] = createSignal(true);
        const [queue, setQueue] = createSignal<QueueState>("idle");
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), PICTURE_TIMEOUT_MS);
        let alive = true;
        onCleanup(() => {
          alive = false;
          ctrl.abort();
          clearTimeout(timer);
        });
        void askPicture(
          pic.blob,
          ctrl.signal,
          () => setUploading(false),
          // A move comes from the table, so no frame can skip a state.
          (phase) => {
            const next = queueMove(queue(), phase);
            if (next !== queue()) setQueue(next);
          },
        ).then((result) => {
          if (!alive) return;
          const found: PictureResult = result ?? {
            // The browser only reports that the request stopped, and the timeout is the
            // only thing here that stops one.
            ids: [],
            box: null,
            error: "timeout",
            action: "retry",
          };
          batch(() => {
            setAnswer(found);
            // Only a complete answer changes what the list shows. A wait that ended with
            // nothing keeps the ranking the reader was looking at.
            if (result && !result.error && !result.busy)
              setLastShownIds(found.ids);
            const outcome = outcomeOf(found);
            if (outcome === "busy") to.busy();
            else if (outcome === "failed") to.failed();
            else if (outcome === "none") to.none();
            else to.done();
          });
        });
        return { uploading, queue };
      },

      busy: () => null,
      failed: () => null,
      none: () => null,
      done: () => null,
    },
  });

  // A state's work starts where the machine is read, so the store keeps it read: a picture has to go
  // out on a tap even while no panel is open.
  createEffect(on(flow, () => {}));

  /** Where the subject sat, as fractions of the staged picture: left, top, width, height.
   *  Null when there is nothing to draw. */
  const box = createMemo<[number, number, number, number] | null>(() => {
    const found = answer()?.box ?? null;
    if (!found) return null;
    return found[2] >= BOX_IS_THE_PICTURE && found[3] >= BOX_IS_THE_PICTURE
      ? null
      : found;
  });

  /** Revokes the preview's object URL: nothing else holds a reference to it. */
  const release = (): void => {
    const previous = untrack(staged);
    if (previous) URL.revokeObjectURL(previous.url);
    setStaged(null);
  };

  /** Ask with a picture. The state leaves nothing of its own behind, so a running request is
   *  called off by the move out of it. */
  const search = (chosen: Queued | null = untrack(staged)): void => {
    if (!chosen) return;
    const state = flow();
    if (state.type === "empty" || state.type === "searching") return;
    setAnswer(null);
    state.to.searching(chosen);
  };

  return {
    on: modeOn,
    answer,
    /** The preview, made from the picture the user chose; once the encode lands it is the
     *  same picture that gets sent. */
    preview: () => staged()?.url ?? "",
    uploading: () => {
      const state = flow();
      return state.type === "searching" ? state.value.uploading() : false;
    },
    /** Where this upload stands in the service's line, or `idle` outside a running request. */
    queue: () => {
      const state = flow();
      return state.type === "searching" ? state.value.queue() : "idle";
    },

    open() {
      setModeOn(true);
      // A drop zone opened over a running request: the request is called off and the user's
      // own picture stays on screen. Nothing else drops a wait mid-flight.
      const state = flow();
      if (state.type !== "searching") return;
      if (untrack(staged)) state.to.staged();
      else state.to.empty();
    },

    /** Leaving picture mode also drops the ranking: keeping it would hide the sort buttons
     *  for a reason nobody could see. */
    close() {
      setModeOn(false);
      const state = flow();
      if (state.type !== "empty") state.to.empty();
      batch(() => {
        setAnswer(null);
        setLastShownIds(null);
      });
      release();
    },

    /** Show a chosen picture and search with it right away. Replaces the picture that was up
     *  and releases its object URL. */
    stage(file: Blob): void {
      // The user's own file goes on screen in the task that handled the tap, before a single
      // byte is re-encoded. On a phone the encode runs long enough that a drop zone still
      // sitting there reads as a dead button.
      release();
      setAnswer(null);
      setStaged({ blob: file, url: URL.createObjectURL(file) });
      // The move into `preparing` calls off whatever the previous picture had running, so
      // these bytes cannot arrive wearing the other picture's results. A state cannot hold
      // itself, so a second picture during an encode empties the slot to leave it first.
      const slot = flow();
      if (slot.type === "preparing") slot.to.empty();
      const next = flow();
      if (next.type !== "preparing") next.to.preparing(file);
    },

    search,

    /** Where the picture stands, and the only answer to that question. */
    state: () => flow.type,
    holds: () => flow.type !== "empty",

    box,

    /** Why the last picture came back with nothing. Empty when there was an answer. */
    error: () => answer()?.error ?? "",

    /** What the user can do next. Empty means no button: the service names it for its own
     *  errors, this file for the browser's. */
    action: () => answer()?.action ?? "",

    /** The ids the list is showing, or null while it still shows its plain matches. */
    lastShownIds,
  };
}

// ---------- the sentence ----------

/** A request that can be called off, for the sentence in the box: its owner is an effect that
 *  re-runs on every question, not a state. The controller and its timeout belong to each other:
 *  a timeout left behind fires at an abort that already happened. */
type Wait = {
  begin(timeoutMs: number): AbortController;
  owns(ctrl: AbortController): boolean;
  finish(ctrl: AbortController): void;
  drop(): void;
};

function makeWait(): Wait {
  let current: {
    ctrl: AbortController;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  return {
    begin(timeoutMs) {
      const ctrl = new AbortController();
      current = { ctrl, timer: setTimeout(() => ctrl.abort(), timeoutMs) };
      return ctrl;
    },
    owns: (ctrl) => current?.ctrl === ctrl,
    finish(ctrl) {
      if (current?.ctrl !== ctrl) return;
      clearTimeout(current.timer);
      current = null;
    },
    drop() {
      if (!current) return;
      current.ctrl.abort();
      clearTimeout(current.timer);
      current = null;
    },
  };
}

/** The sentence in the box: one question at a time, and an answer that speaks only for the
 *  sentence it answered. */
function makeSentenceSearch({
  pictureHolds,
  semanticOn,
}: {
  pictureHolds: Accessor<boolean>;
  semanticOn: Accessor<boolean>;
}) {
  const [pending, setPending] = createSignal(false);
  /** The answer carries the sentence it answers, so a slow reply is never applied to a newer
   *  one. */
  const [sentenceAnswer, setSentenceAnswer] = createSignal<
    (SemanticResult & { query: string }) | null
  >(null);
  const sentenceWait = makeWait();

  /** The last request's sentence, and whether it came back with nothing. A service that
   *  answered and found nothing is a normal empty answer, so that is not a failure. */
  const [asked, setAsked] = createSignal("");
  const [askFailed, setAskFailed] = createSignal(false);
  const [retryNonce, setRetryNonce] = createSignal(0);

  /** Call off the sentence in flight. A reply that lands late can only be applied to the
   *  wrong sentence. */
  function cancelSentence(): void {
    sentenceWait.drop();
    setPending(false);
  }

  // pictureHolds is a dependency so that dropping a picture re-asks the sentence still in the
  // box. retryNonce is there for the user who taps 重试 on the sentence already in the box.
  createEffect(
    on([searchText, pictureHolds, semanticOn, retryNonce], ([typed]) => {
      cancelSentence();
      const q = typed.trim();
      if (
        !shouldAskText({
          pictureHolds: pictureHolds(),
          semanticOn: semanticOn(),
          query: q,
        })
      )
        return;
      // A stalled request must not freeze the list: the timeout aborts it, local matches stay.
      const ctrl = sentenceWait.begin(SEARCH_TIMEOUT_MS);
      setAsked(q);
      setAskFailed(false);
      setPending(true);
      void askSettings(q, ctrl.signal).then((result) => {
        if (result && !ctrl.signal.aborted)
          setSentenceAnswer({ ...result, query: q });
        if (sentenceWait.owns(ctrl))
          batch(() => {
            sentenceWait.finish(ctrl);
            setAskFailed(!result || ctrl.signal.aborted);
            setPending(false);
          });
      });
    }),
  );

  /** An older sentence's failure says nothing about the search now in the box. */
  const askFailure = createMemo(
    () => asked() === searchText().trim() && askFailed(),
  );

  /** Bump to ask about the sentence already in the box. */
  const retryAsk = () => setRetryNonce((n) => n + 1);

  /** An answer to an older sentence must not rank a newer one, hence the query check. */
  const sentenceIds = createMemo<number[]>(() => {
    const found = sentenceAnswer();
    return found && found.query === searchText().trim() ? found.ids : [];
  });

  return { pending, askFailure, retryAsk, ids: sentenceIds };
}

// ---------- the store ----------

// This store is global on purpose - one search box per app - so its memos and its effect are
// created in a root, the same way derivedStore wraps its own.
const store = createRoot(() => {
  /** Whether the user's switch is on, and only for a build that was given an address. */
  const semanticOn = createMemo(() => semanticSearch() && searchConfigured);

  /** The hint in the search box. When the enhanced search is on, the hint is a sample query
   *  that the user can type as it is. */
  const searchPlaceholder = createMemo(() =>
    semanticOn() ? tr("search.placeholderEnhanced") : tr("search.placeholder"),
  );

  const picture = makePictureSearch();
  const sentence = makeSentenceSearch({
    pictureHolds: picture.holds,
    semanticOn,
  });

  // The switch covers both ways to ask, so turning it off closes the picture. The circle that
  // opened it hides with the switch, so a drop zone left open would have no way out, and the list
  // would keep a picture's order after the user turned the search off.
  createEffect(
    on(
      semanticOn,
      (on) => {
        if (!on) picture.close();
      },
      { defer: true },
    ),
  );

  /** Which route the list follows. The box and the grid both read it, so they cannot disagree
   *  about the order while a ranking is on screen. */
  const route = createMemo<Route>(() =>
    routeFor({
      pictureOn: picture.on(),
      pictureIds: picture.lastShownIds(),
      semanticOn: semanticOn(),
      query: searchText().trim(),
      textIds: sentence.ids(),
    }),
  );

  /** Whether a model ranking orders the list. */
  const semanticActive = createMemo(() => route().by !== "none");

  /** The rows on screen are a photograph's answer. An answer of "nothing" counts too, because the
   *  emptiness came from the picture. With no answer yet, the list is the user's own text
   *  search, and the tab filters it. */
  const pictureAnswers = createMemo(() => route().by === "picture");

  return {
    semanticOn,
    searchPlaceholder,
    picture,
    pending: sentence.pending,
    askFailure: sentence.askFailure,
    retryAsk: sentence.retryAsk,
    semanticActive,
    pictureAnswers,
    route,
  };
});

// Re-exported so components do not depend on where the address comes from.
export { searchConfigured } from "../data/searchApi";

export const {
  semanticOn,
  searchPlaceholder,
  semanticActive,
  pictureAnswers,
  route,
  picture,
  askFailure,
  retryAsk,
  pending: semanticPending,
} = store;

/** What the picture has to say about a list that came back empty. */
export type PictureMeaning = "working" | "failed" | "noMatch" | "nothing";

/** `busy` sits with `working` because the service reports that it is busy, so a verdict there
 * would be a guess about a reply still on its way. `done` and `empty` mean the picture's answer
 * is not why the list is empty. The switch covers every state, so a new one fails to compile
 * here.
 */
export function pictureMeaning(): PictureMeaning {
  switch (picture.state()) {
    case "preparing":
    case "staged":
    case "searching":
    case "busy":
      return "working";
    case "failed":
      return "failed";
    case "none":
      return "noMatch";
    case "empty":
    case "done":
      return "nothing";
  }
}
