/**
 * Which way a finger meant to go.
 *
 * A drag begins as a tap: the first pixels are drift, and both axes still look possible. Once the
 * press has left that drift the larger component wins, and the other axis belongs to whatever lies
 * under the finger — a panel's scroll, a row's sideways pan.
 */
export type Axis = "x" | "y";

/** How far a press may drift and still count as a tap. */
export const TAP_SLOP = 4;

export function createAxisLock(slop: number = TAP_SLOP) {
  let axis: Axis | null = null;
  return {
    /** A new finger arrives. */
    reset(): void {
      axis = null;
    },
    /** The axis this move has committed to, or nothing while it is still a tap's drift. */
    of(dx: number, dy: number): Axis | null {
      if (axis) return axis;
      if (Math.hypot(dx, dy) <= slop) return null;
      axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      return axis;
    },
  };
}
