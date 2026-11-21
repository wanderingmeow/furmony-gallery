// src/hooks/useTranslation.ts - runtime translation of one piece of text: the request, the cache,
// the reader's tap, and the moment words count as new.
//
// The API answers most fields in the language the request asked for. The ones that did not come that
// way need a request of their own, and this is what keeps it.
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
} from "solid-js";
import { locale, tr } from "../i18n";
import { needsTranslation } from "../model/descriptionText";
import {
  translateProse,
  translateTarget,
  translationIsCached,
} from "../data/translateText";

type Job =
  | { kind: "idle" }
  | { kind: "busy"; id: string | number }
  | { kind: "done"; id: string | number; text: string }
  | { kind: "failed"; id: string | number };

/** A request worth sending: these words, into the language on screen. */
interface Question {
  id: string | number;
  text: string;
  into: string;
}

export interface TranslationOptions {
  /** The words as they came, in whatever language that is. */
  text: () => string;
  /** What those words describe. An answer about something else counts as no answer. */
  id: () => string | number;
  /** How long words count as having just arrived. */
  arrivalMs: number;
}

export function useTranslation(props: TranslationOptions) {
  const [job, setJob] = createSignal<Job>({ kind: "idle" });
  const [wantTranslation, setWantTranslation] = createSignal(true);
  let inFlight: AbortController | undefined;

  const question = createMemo<Question | null>(() => {
    const into = translateTarget(locale());
    const text = props.text();
    if (!into || !needsTranslation(text, locale())) return null;
    return { id: props.id(), text, into };
  });

  // A screen can be kept alive while the thing it describes gives way to the next, so an answer
  // about an earlier one counts as no answer.
  const current = createMemo<Job>(() => {
    const j = job();
    return j.kind !== "idle" && j.id !== props.id() ? { kind: "idle" } : j;
  });

  function stop(): void {
    inFlight?.abort();
    inFlight = undefined;
  }

  // The blur runs over words that have just arrived, and stops when the sweep has run its course.
  const [arriving, setArriving] = createSignal(false);
  let spent: number | undefined;
  const wordsArrived = () => {
    window.clearTimeout(spent);
    setArriving(true);
    spent = window.setTimeout(() => setArriving(false), props.arrivalMs);
  };
  onCleanup(() => window.clearTimeout(spent));

  async function run(q: Question): Promise<void> {
    // Whatever is on its way belongs to a question the row no longer has.
    stop();
    const giveUp = new AbortController();
    inFlight = giveUp;
    const fromNetwork = !translationIsCached(q.text, q.into);
    setJob({ kind: "busy", id: q.id });
    try {
      const out = await translateProse(q.text, q.into, giveUp.signal);
      if (inFlight === giveUp) {
        setJob({ kind: "done", id: q.id, text: out });
        if (fromNetwork) wordsArrived();
      }
    } catch {
      if (inFlight === giveUp) setJob({ kind: "failed", id: q.id });
    } finally {
      if (inFlight === giveUp) inFlight = undefined;
    }
  }

  const pending = createMemo(() => {
    const q = question();
    return wantTranslation() && q && current().kind === "idle" ? q : null;
  });

  createEffect(
    on(pending, (q) => {
      if (q) void run(q);
    }),
  );

  const translated = () => {
    const j = current();
    return wantTranslation() && j.kind === "done" ? j.text : undefined;
  };

  // Call off what is on its way. An answer that already landed stays in the job for the next tap.
  function turnDown(): void {
    stop();
    batch(() => {
      setWantTranslation(false);
      if (current().kind === "busy") setJob({ kind: "idle" });
    });
  }

  // An answer in hand is handed over; an answer that came back wrong is forgotten, which is what
  // lets `pending` send the question again.
  function askAgain(): void {
    const j = current();
    if (j.kind === "done") wordsArrived();
    else if (j.kind === "failed") setJob({ kind: "idle" });
    setWantTranslation(true);
  }

  const toggle = (): void => (lit() ? turnDown() : askAgain());

  // A failure reads as off, so the next tap looks like the first one.
  const lit = () => wantTranslation() && current().kind !== "failed";

  return {
    arriving,
    busy: () => current().kind === "busy",
    offer: () => question() !== null,
    lit,
    label: () => (lit() ? tr("detail.showOriginal") : tr("detail.translate")),
    showing: () => translated() !== undefined,
    shownText: () => translated() ?? props.text(),
    toggle,
  };
}
