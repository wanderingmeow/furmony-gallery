import type uPlot from "uplot";

/** The hover line's trip from one chart to the other, taken by value, so the fraction between two
 *  months travels with it. Both reads are unlocked, which is the space `cursor.left` lives in:
 *  plot area, CSS px. A negative left hides the line. */
export function syncLeft(
  src: Pick<uPlot, "posToVal">,
  target: Pick<uPlot, "valToPos">,
  left: number | null,
): number {
  if (left === null) return -1;
  return target.valToPos(src.posToVal(left, "x"), "x");
}
