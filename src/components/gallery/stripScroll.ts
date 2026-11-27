// src/components/gallery/stripScroll.ts - where the strip of small copies lands when a square is
// chosen.

/** The farthest the strip can run: its last square then sits at the far edge of the row. */
export const lastScroll = (scrollWidth: number, clientWidth: number): number =>
  Math.max(scrollWidth - clientWidth, 0);

/** The centered position, clamped: asked past an end, the browser paints a jump before it moves. */
export const stripScroll = (
  scrollLeft: number,
  delta: number,
  last: number,
): number => Math.min(Math.max(scrollLeft + delta, 0), last);

// A move under this reads as nothing, and the boxes measured here carry fractions of a pixel.
const MIN_MOVE_PX = 2;

export const worthMoving = (to: number, scrollLeft: number): boolean =>
  Math.abs(to - scrollLeft) >= MIN_MOVE_PX;
