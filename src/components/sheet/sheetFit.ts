import { EASE, prefersReducedMotion, SHEET_MOVE_MS } from "../../draw/anim";
import { SCROLLER } from "./sheetScroll";

const stood = new WeakMap<HTMLElement, number>();
const gliding = new WeakMap<HTMLElement, Animation>();

export type FitCause = "window" | "content";

// A glide at each step of a dragged window never catches up with its own next measure, so a window
// places the card outright. The stamp outlives the last step: a picture settling just after the window
// stops is worth easing into.
const moved = new WeakMap<HTMLElement, number>();
const WINDOW_SETTLE_MS = 200;

/** The box the card may stand at: the layer inside the gap it pads itself by. A client box keeps its
 *  padding, so the gap comes back out. */
function roomHeight(card: HTMLElement): number {
  const layer = card.parentElement;
  if (!layer) return card.clientHeight;
  const pad = getComputedStyle(layer);
  return (
    layer.clientHeight -
    (parseFloat(pad.paddingTop) || 0) -
    (parseFloat(pad.paddingBottom) || 0)
  );
}

/** Stand the card as tall as its content, with the room the window leaves as its ceiling, and nothing
 *  under the content: the bar is the last thing in it.
 *
 *  The content is read from the scroller's own child. A scroller grown from a zero basis sizes to its
 *  content in Chromium and to the space it was handed in Safari, so letting the card's height go and
 *  asking it what it became answers differently in each.
 */
export function fitSheetCard(
  el: Element | null,
  cause: FitCause = "content",
): void {
  const card = el?.closest<HTMLElement>(".sheet-card");
  const scroller = card?.querySelector<HTMLElement>(SCROLLER);
  const content = scroller?.firstElementChild as HTMLElement | null;
  if (!card || !scroller || !content) return;
  // The stamp marks the window having moved, not a height changing: a step often measures the same
  // height before the content has re-laid-out.
  if (cause === "window") moved.set(card, Date.now());
  // The scroller's own bottom band, plus what the card holds outside it: the header and the bar.
  const band = parseFloat(getComputedStyle(scroller).paddingBottom) || 0;
  const foot = [...card.children].reduce(
    (px, k) => (k === scroller ? px : px + (k as HTMLElement).offsetHeight),
    0,
  );
  const natural = content.offsetHeight + band + foot;
  if (natural <= 0) return;
  const room = roomHeight(card);
  const to = Math.min(room, natural);
  const settled = stood.get(card);
  // The same height is not a move: a glide already on its way there is left to finish.
  if (to === settled) return;
  // Where the card stands on screen, a glide halfway through included: the next leaves from there.
  const onScreen = card.offsetHeight;
  card.style.setProperty("--sheet-cap", `min(100%, ${natural}px)`);
  stood.set(card, to);
  const glides =
    cause === "content" &&
    Date.now() - (moved.get(card) ?? 0) > WINDOW_SETTLE_MS;
  if (!glides || settled === undefined || prefersReducedMotion()) {
    gliding.get(card)?.cancel();
    gliding.delete(card);
    return;
  }
  gliding.get(card)?.cancel();
  gliding.set(
    card,
    card.animate([{ height: `${onScreen}px` }, { height: `${to}px` }], {
      duration: SHEET_MOVE_MS,
      easing: EASE,
    }),
  );
}
