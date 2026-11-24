import { createMachine } from "@solid-primitives/state-machine";
import { createEffect, on, onCleanup, untrack } from "solid-js";

// The route changes once the arrival finishes: moving earlier drops the sheet mid-slide or mid-fade.
const SETTLE_MS = (ms: number): number => ms + 80;

type Presence = {
  /** The layer is off screen. */
  hidden: { value: null; to: "showing" };
  /** The layer is on screen and the route points here. */
  showing: {
    input: { fresh: boolean };
    value: null;
    to: "routeOut" | "dismissOut";
  };
  /** The route moved away. The slide runs, and the layer goes when it ends. A route that comes back
   *  before then ends the slide where it stands. */
  routeOut: { value: null; to: "showing" | "hidden" };
  /** ✕ or a fling asked for it. The slide runs, then the route moves. A second ask during the
   *  slide is ignored, so the slide keeps the clock it started with. */
  dismissOut: { value: null; to: "showing" | "hidden" };
};

/** The sheet's round trip with the route: a back press moves the route while the layer is still on
 *  screen, so the layer gets one slide to finish. A route that comes back during that slide keeps
 *  the sheet; a close from inside moves the route only once the slide is over. */
export function useSheetPresence(options: {
  /** Read through a memo: a new route match must not replay the arrival. */
  open: () => boolean;
  /** The route's own answer, given once the sheet has left. */
  onDismiss: () => void;
  /** How long the layer's current way of leaving takes. */
  moveMs: () => number;
  /** The layer is arriving from off screen. */
  onEnter: () => void;
  /** The route moved away and the layer is up: a slide starts. */
  onLeave: () => void;
  /** The route came back before the slide ended. */
  onReturn: () => void;
}) {
  /** The way out: the layer's own slide, with the settle timer disposed when the state ends. */
  function slide(then: () => void) {
    options.onLeave();
    const settle = setTimeout(then, SETTLE_MS(options.moveMs()));
    onCleanup(() => clearTimeout(settle));
  }

  // The layer keeps its own state, because the route can be gone while a slide is still running.
  const machine = createMachine<Presence>({
    initial: untrack(options.open)
      ? { type: "showing", input: { fresh: true } }
      : "hidden",
    states: {
      hidden: () => null,
      // A fresh arrival starts off screen; a route that came back mid-slide keeps the height the
      // finger left it at.
      showing({ fresh }) {
        if (fresh) options.onEnter();
        else options.onReturn();
        return null;
      },
      routeOut(_, to) {
        slide(() => to.hidden());
        return null;
      },
      dismissOut(_, to) {
        slide(() => {
          to.hidden();
          // A back press during the slide already moved the route away.
          if (options.open()) options.onDismiss();
        });
        return null;
      },
    },
  });

  // The route is the only thing that moves the layer from outside. A route that comes back ends the
  // slide at once: the dim's animation restarts on the class swap.
  createEffect(
    on(options.open, (up) => {
      const state = untrack(machine);
      if (up) {
        if (state.type === "hidden") state.to.showing({ fresh: true });
        else if (state.type !== "showing") state.to.showing({ fresh: false });
        return;
      }
      if (state.type === "showing") state.to.routeOut();
    }),
  );

  /** ✕ or a fling: the route still points here, so it changes once the slide is over. */
  function dismiss() {
    const state = untrack(machine);
    if (state.type === "showing") state.to.dismissOut();
  }

  return {
    shown: () => machine().type !== "hidden",
    closing: () => {
      const { type } = machine();
      return type === "routeOut" || type === "dismissOut";
    },
    dismiss,
  };
}
