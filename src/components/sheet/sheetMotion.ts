import type { JSX } from "solid-js";
import { EASE, prefersReducedMotion } from "../../draw/anim";
import { cardGap, shapeAt, sheetCardOuterW } from "../../draw/layout";
import { watchViewport } from "../ui/viewport";

export const SLIDE_MS = 300;
// Shorter than the slide: a fade reads as slower than a move of the same length. The panel and a
// reduce-motion phone sheet both present this way.
export const FADE_MS = 180;

// As a fraction of the sheet's height, about 100px on a phone: the corners finish rounding well
// before the drag distance `shouldDismiss` counts as closing.
const CORNER_TRAVEL = 0.12;

/** Where the sheet is on its way between the bottom of the screen and home. */
export interface SheetPose {
  /** 0 at home, 1 where a slide starts and where a fade has nothing to show. */
  pos: number;
  dragging: boolean;
  panel: boolean;
  fades: boolean;
  /** The gap between the card and the edges of the screen, in px. */
  inset: number;
  /** The card's own outer width, which is what `max-width` on the card must be. */
  maxW: number;
}

/** How the sheet presents: `shapeAt` picks the panel, the finger picks the transform. */
export function useSheetPose(drag: {
  pos: () => number;
  dragging: () => boolean;
  gestured: () => boolean;
}) {
  const { viewportW, viewportH, safe } = watchViewport();
  const panel = () => shapeAt(viewportW(), viewportH()) === "panel";
  const inset = () => cardGap(viewportW(), viewportH());
  const maxW = () => sheetCardOuterW(viewportW(), viewportH(), safe());
  // A drag pulls the card by hand and the fade branch has no transform to pull, so a sheet the
  // finger has touched stays on the transform for the whole round trip.
  const fades = () => (panel() || prefersReducedMotion()) && !drag.gestured();
  return {
    panel,
    pose: (): SheetPose => ({
      pos: drag.pos(),
      dragging: drag.dragging(),
      panel: panel(),
      fades: fades(),
      inset: inset(),
      maxW: maxW(),
    }),
    moveMs: () => (fades() ? FADE_MS : SLIDE_MS),
  };
}

/** The full-screen layer the card rides in. Its padding is the gap the card keeps at every edge, so
 *  the same number stands the card in whether it slides or fades. */
export function layerStyle(pose: SheetPose): JSX.CSSProperties {
  const pad = { padding: `${pose.inset}px` };
  if (!pose.fades)
    return {
      ...pad,
      transform: `translateY(${pose.pos * 100}%)`,
      transition: pose.dragging ? "none" : `transform ${SLIDE_MS}ms ${EASE}`,
    };
  return {
    ...pad,
    opacity: `${1 - pose.pos}`,
    // Scaling a full-screen card would uncover the backdrop at its edges.
    ...(pose.panel
      ? {
          transform: `scale(${1 - 0.03 * pose.pos})`,
          transition: `opacity ${FADE_MS}ms ${EASE}, transform ${FADE_MS}ms ${EASE}`,
        }
      : { transition: `opacity ${FADE_MS}ms ${EASE}` }),
  };
}

/** The card itself. The finger sets the radius, so nothing may lag behind it; after a release the
 *  radius eases along with the slide. */
export function cardStyle(
  pose: SheetPose & { closing: boolean },
): JSX.CSSProperties {
  return {
    "--sheet-pull": `${cornerPull(pose)}`,
    "--sheet-gap": `${pose.inset}px`,
    transition: pose.dragging ? "none" : `border-radius ${SLIDE_MS}ms ${EASE}`,
    ...(pose.panel ? { "max-width": `${pose.maxW}px` } : null),
    // A card that stands in from the edges is as tall as the content fitSheetCard measured, with the
    // room the window leaves as its ceiling. A phone's sheet fills the screen it slides up on.
    ...(pose.inset > 0 ? { height: "var(--sheet-cap, 100%)" } : null),
  };
}

/** Only the drag and the exit round the top corners: opening also walks `pos` from 1 to 0, and the
 *  sheet arrives square. */
export function cornerPull(
  pose: Pick<SheetPose, "pos" | "dragging"> & { closing: boolean },
): number {
  return pose.dragging || pose.closing
    ? Math.min(1, pose.pos / CORNER_TRAVEL)
    : 0;
}
