import { createEffect, createSignal, on, onCleanup, untrack } from "solid-js";

// The route changes once the arrival finishes: moving earlier drops the sheet mid-slide or mid-fade.
const SETTLE_MS = (ms: number): number => ms + 80;

/** The sheet's round trip with the route: a back press moves the route while the layer is still on
 *  screen, so the layer gets one slide to finish. A route that comes back during that slide keeps the
 *  sheet; a close from inside moves the route only once the slide is over. */
export function useSheetPresence(options: {
  /** Read through a memo: a new route match must not replay the arrival. */
  open: () => boolean;
  /** The route's own answer, given once the sheet has left. */
  onDismiss: () => void;
  /** How long the layer's current way of leaving takes. */
  moveMs: () => number;
  /** The layer is arriving. */
  onEnter: () => void;
  /** The route moved away and the layer is up: a slide starts. */
  onLeave: () => void;
  /** The route came back before the slide ended. */
  onReturn: () => void;
}) {
  // The layer keeps its own signal, because the route can be gone while a slide is still running.
  const [shown, setShown] = createSignal(untrack(options.open));
  const [closing, setClosing] = createSignal(false);
  let exitTimer: number | undefined;

  function slideOut(settle: () => void) {
    setClosing(true);
    options.onLeave();
    clearTimeout(exitTimer);
    exitTimer = setTimeout(settle, SETTLE_MS(options.moveMs()));
  }

  createEffect(
    on(options.open, (up) => {
      if (!up) return;
      setClosing(false);
      options.onEnter();
    }),
  );

  createEffect(
    on(
      options.open,
      (isOpen) => {
        if (isOpen) {
          setShown(true);
          return;
        }
        if (!shown() || closing()) return;
        // The route moved away while the layer was up: wait out the slide.
        slideOut(() => {
          // The route came back during the slide, so the sheet simply stays.
          if (options.open()) {
            setClosing(false);
            options.onReturn();
            return;
          }
          setShown(false);
        });
      },
      { defer: true },
    ),
  );

  onCleanup(() => clearTimeout(exitTimer));

  /** ✕ or a fling: the route still points here, so it changes once the slide is over. */
  function dismiss() {
    slideOut(() => {
      setShown(false);
      // A back press during the slide already moved the route away.
      if (options.open()) options.onDismiss();
    });
  }

  return { shown, closing, dismiss };
}
