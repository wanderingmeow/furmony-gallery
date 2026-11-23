import { prefersReducedMotion, SHEET_MOVE_MS, ease } from "../../draw/anim";

// Marks the sheet's own scroll container, so these functions find it from outside its component.
export const SCROLLER = "[data-sheet-scroll]";
// The panel's right column scrolls on its own, keeping the picture still while the table moves.
export const COL_SCROLLER = "[data-sheet-col-scroll]";

let scrollRaf = 0;
let stopYielding: (() => void) | null = null;

/** Scroll the content back to the top when it changes in place: tapping a related listing puts a new
 *  one at the bottom of the sheet, so without this the change looks like nothing happened. Call it
 *  once the new content is in place. Driven by hand rather than `behavior:'smooth'`, so it ends
 *  together with the sheet's own transition. */
export function scrollSheetToTop(): void {
  const el =
    document.querySelector<HTMLElement>(COL_SCROLLER) ??
    document.querySelector<HTMLElement>(SCROLLER);
  if (!el) return;
  cancelAnimationFrame(scrollRaf);
  stopYielding?.();
  stopYielding = null;

  const from = el.scrollTop;
  if (from <= 0) return;
  if (prefersReducedMotion()) {
    el.scrollTop = 0;
    return;
  }

  // A wheel or a finger on the content wins: the glide stops where it stands.
  const giveUp = () => {
    cancelAnimationFrame(scrollRaf);
    stopYielding?.();
    stopYielding = null;
  };
  el.addEventListener("wheel", giveUp, { passive: true });
  el.addEventListener("touchstart", giveUp, { passive: true });
  stopYielding = () => {
    el.removeEventListener("wheel", giveUp);
    el.removeEventListener("touchstart", giveUp);
  };

  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / SHEET_MOVE_MS);
    el.scrollTop = from * (1 - ease(k));
    if (k < 1) {
      scrollRaf = requestAnimationFrame(step);
      return;
    }
    stopYielding?.();
    stopYielding = null;
  };
  scrollRaf = requestAnimationFrame(step);
}
