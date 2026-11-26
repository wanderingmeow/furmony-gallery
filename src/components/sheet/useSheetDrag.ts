import { createEffect, createSignal, on, onCleanup } from "solid-js";
import {
  MAX_SAMPLES,
  flingVelocity,
  shouldDismiss,
  type Sample,
} from "../../draw/fling";
import { SLIDE_MS } from "./sheetMotion";
import { createAxisLock } from "../../draw/axisLock";

/** The drag that closes a phone sheet: it takes the gesture only once the content cannot scroll up
 *  any more, reports how far the card travelled, and hands the decision to `shouldDismiss`. */
export function useSheetDrag(options: {
  /** The card, whose height turns a drag in px into the 0..1 the styles read. */
  getSheet: () => HTMLElement | null;
  /** A card that sits in from every edge has no bottom to leave, so it is never dragged. */
  draggable: () => boolean;
  /** A fling, or a pull far enough, closes the sheet. */
  onDismiss: () => void;
}) {
  const [pos, setPos] = createSignal(0);
  const [dragging, setDragging] = createSignal(false);
  // The fade branch has no transform to pull: the flag keeps the transform for the whole round trip,
  // so a sheet in mid-air is not handed to the fade.
  const [gestured, setGestured] = createSignal(false);
  // The listeners sit on the sheet's own scroller, not the full-screen layer, so a drag on the
  // backdrop never closes the sheet. Both change: the sheet remounts on each open, a phone turns.
  const [scroller, setScroller] = createSignal<HTMLDivElement | null>(null);

  let startX = 0;
  let startY = 0;
  let startScrollTop = 0;
  // A hand cannot pan a row sideways without travelling some vertical, and the rows inside a sheet
  // (the thumbs, the related cards) scroll under that same finger. So the drag waits for the gesture
  // to say which way it is going, and a move that went further across than down is not the sheet's to
  // take: taking it would have moved the card and, through preventDefault, stopped the row scrolling.
  const lock = createAxisLock();
  let returnTimer: number | undefined;
  const samples: Sample[] = [];

  function onStart(e: TouchEvent) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    lock.reset();
    startScrollTop = (e.currentTarget as HTMLElement).scrollTop;
    samples.length = 0;
    samples.push({ t: performance.now(), y: startY });
  }

  function onMove(e: TouchEvent) {
    const sheet = options.getSheet();
    if (!sheet) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (lock.of(dx, dy) !== "y") return;
    // Before the content runs out of room to scroll up, a downward drag just scrolls it.
    if (startScrollTop > 0 || dy <= 0) return;
    e.preventDefault();
    setDragging(true);
    setGestured(true);
    const h = sheet.offsetHeight || window.innerHeight;
    setPos(Math.min(Math.max(0, dy) / h, 1));
    samples.push({ t: performance.now(), y: e.touches[0].clientY });
    if (samples.length > MAX_SAMPLES) samples.shift();
  }

  function onEnd() {
    if (!dragging()) return;
    setDragging(false);
    if (shouldDismiss(pos(), flingVelocity(samples, performance.now())))
      options.onDismiss();
    else bounceBack();
  }

  // Once the bounce back lands, the sheet goes back to the fade.
  function bounceBack() {
    setPos(0);
    clearTimeout(returnTimer);
    returnTimer = setTimeout(() => setGestured(false), SLIDE_MS);
  }

  function onCancel() {
    if (dragging()) {
      setDragging(false);
      bounceBack();
    }
    samples.length = 0;
  }

  createEffect(
    on([scroller, options.draggable], ([el, draggable]) => {
      if (!el || !draggable) return;
      el.addEventListener("touchstart", onStart, { passive: true });
      el.addEventListener("touchmove", onMove, { passive: false }); // needs preventDefault
      el.addEventListener("touchend", onEnd, { passive: true });
      el.addEventListener("touchcancel", onCancel, { passive: true });
      onCleanup(() => {
        el.removeEventListener("touchstart", onStart);
        el.removeEventListener("touchmove", onMove);
        el.removeEventListener("touchend", onEnd);
        el.removeEventListener("touchcancel", onCancel);
      });
    }),
  );

  onCleanup(() => clearTimeout(returnTimer));

  return {
    pos,
    dragging,
    gestured,
    /** Put this on the sheet's own scroller to arm the drag. */
    bindScroller: setScroller,
    /** Where the card sits on its way: 0 at home, 1 where a slide starts. A drag writes it by hand;
     *  the sheet writes it at the ends of a round trip. */
    place: setPos,
    /** The fade may have the transform again, and any promise to hand it back later is off. */
    dropGesture: () => {
      clearTimeout(returnTimer);
      setGestured(false);
    },
    /** Keep the transform where it is: a pending hand-back is off, but nothing changes now. */
    keepTransform: () => clearTimeout(returnTimer),
  };
}
