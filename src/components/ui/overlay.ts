import {
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  untrack,
  type Accessor,
} from "solid-js";
import { scrollLock } from "../../draw/scrollLock";

/** Dim alone leaves the page behind reading as content; the blur is what turns it into background. */
export const BACKDROP = "absolute inset-0 bg-black/30 backdrop-blur-md";

/** Both ends of that dim, each carrying its own reduced-motion answer (./theme.css). */
export const BACKDROP_IN =
  "animate-fade-in motion-reduce:animate-fade-quiet-in";
export const BACKDROP_OUT =
  "animate-fade-out motion-reduce:animate-fade-quiet-out";

/** The document behind a layer holds still while that layer is on screen, a departure included: a
 *  wheel over a dim that is fading out is still a wheel over a dim. `scrollLock` counts holders, so
 *  each rise of `open` pairs with one release. Content can mount later than the lock, so the scroller
 *  is looked up when the touch arrives. */
export function holdScroll(
  open: () => boolean,
  getScrollable: () => HTMLElement | null,
): void {
  createEffect(
    on(open, (up) => {
      if (!up) return;
      const release = scrollLock.acquire({ document, getScrollable });
      onCleanup(release);
    }),
  );
}

/** A layer that stays on screen for its own exit, so nothing is yanked mid-fade and a fast double
 *  press does not blink. */
export function usePresence(open: () => boolean, ms: number) {
  const [shown, setShown] = createSignal(untrack(open));
  const [closing, setClosing] = createSignal(false);
  let leave: number | undefined;

  createEffect(
    on(
      open,
      (isOpen) => {
        clearTimeout(leave);
        if (isOpen) {
          setShown(true);
          setClosing(false);
          return;
        }
        if (!shown()) return;
        setClosing(true);
        leave = setTimeout(() => setShown(false), ms);
      },
      { defer: true },
    ),
  );

  onCleanup(() => clearTimeout(leave));

  return { shown, closing };
}

/** What a layer shows while it leaves. `usePresence` keeps a layer on screen for its own exit, and
 *  the value it was drawn from is often cleared by then. Returning nothing then would blank the
 *  layer mid-fade and shrink it to an empty box.
 *
 *  `whileLeaving` says when an empty read means the layer is leaving. While it is not leaving, an
 *  empty read is the truth about the page, and it stays on screen. */
export function heldLast<T>(
  read: () => T | null | undefined,
  whileLeaving: () => boolean = () => true,
): Accessor<T | null | undefined> {
  let last: T | undefined;
  return createMemo(() => {
    const now = read();
    if (now !== undefined && now !== null) {
      last = now;
      return now;
    }
    return whileLeaving() ? last : now;
  });
}

// Where a Tab can land, in the order the user meets it.
const FOCUSABLE =
  "a[href], button:not([disabled]), input:not([disabled])," +
  " select:not([disabled]), textarea:not([disabled])," +
  ' [tabindex]:not([tabindex="-1"])';

/**
 * While a layer is up, focus stays inside it and returns where it was: the plate takes the first
 * focus, Tab wraps at both ends, Escape answers as cancel, and the page outside stops taking input.
 * Where a browser has no `inert`, the Tab wrap alone keeps the round trip inside the plate.
 *
 * The page outside means this app's own mount: a layer's content goes into a portal beside it, so
 * `inert` on the mount never reaches the layer asking for the hold.
 */
export function holdFocus(options: {
  open: () => boolean;
  onClose: () => void;
  getPlate: () => HTMLElement | undefined;
}): void {
  // The value comes from the source, so the phase that changes the page reads no signal.
  createEffect(
    on(options.open, (up) => {
      if (!up) return;
      const outside = document.getElementById("root");
      const held = document.activeElement;
      outside?.setAttribute("inert", "");
      options.getPlate()?.focus();

      const onKey = (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
          options.onClose();
          return;
        }
        const plate = options.getPlate();
        if (event.key !== "Tab" || !plate) return;
        const stops = [...plate.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (stops.length === 0) return;
        const first = stops[0];
        const last = stops[stops.length - 1];
        const at = document.activeElement;
        if (event.shiftKey && (at === first || at === plate)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && at === last) {
          event.preventDefault();
          first.focus();
        }
      };
      document.addEventListener("keydown", onKey);
      onCleanup(() => {
        document.removeEventListener("keydown", onKey);
        outside?.removeAttribute("inert");
        if (held instanceof HTMLElement) held.focus();
      });
    }),
  );
}
