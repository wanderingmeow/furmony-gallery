import { EASE } from "../../draw/anim";

/** The height a picture stands at: a held one takes the ceiling the screen gives, a measured one
 *  fills the width and stops there. 0 leaves the decision to the layout. */
export function fittedHeight(
  pic: { naturalWidth: number; naturalHeight: number },
  width: number,
  cap: number,
  held = false,
): number {
  if (held) return cap;
  if (width <= 0 || pic.naturalHeight <= 0) return 0;
  return Math.min(width / (pic.naturalWidth / pic.naturalHeight), cap);
}

/** The height the picture is drawn at: the ceiling when held, then the height it measured at, then
 *  the one the skeleton held. */
export function heightStyle(box: {
  held: boolean;
  cap: number;
  measured: number;
  skeleton: number;
}): string {
  if (box.held) return `${box.cap}px`;
  if (box.measured) return `${box.measured}px`;
  if (box.skeleton) return `${box.skeleton}px`;
  return "auto";
}

/** The transition a picture carries. A held one has no height to move to, so the fade is timed alone. */
export function moveStyle(motion: { held: boolean; eased: boolean }): string {
  if (motion.held) return "opacity 300ms";
  return motion.eased ? `height 220ms ${EASE}, opacity 300ms` : "none";
}
