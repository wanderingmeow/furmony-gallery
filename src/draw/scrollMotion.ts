// src/draw/scrollMotion.ts - how fast the page moves, and what that means for pictures.

/**
 * A step this quick crosses the screen faster than a picture is worth its cost. The cards it
 * passes hold their pictures.
 *
 * 2.5 px/ms is about three screens a second: slower than a thumb drag across the scrollbar
 * track, faster than a flick on a phone.
 */
export const FAST_PX_PER_MS = 2.5;

/**
 * How long the page has to stop moving fast before pictures come back. A drag ends in a few
 * small steps. Turning the pictures on at the first slow one starts them while the cards are
 * still flying past.
 */
export const SETTLE_MS = 120;

/** Whether the step from prevY to y took less time than a picture is worth. */
export function isFast(y: number, prevY: number, elapsedMs: number): boolean {
  if (elapsedMs <= 0) return false;
  return Math.abs(y - prevY) / elapsedMs > FAST_PX_PER_MS;
}

/**
 * The motion state of one page, so a card can be told whether its picture is worth starting.
 *
 * `step` belongs in the scroll frame the page already runs, with the same position and clock it
 * reads there. `report` runs when the answer changes.
 *
 * The first step sets the baseline and says nothing about speed. A visit that comes back to a
 * saved position opens with one huge jump. The cards at that position are the ones the reader
 * came back for.
 */
export function createScrollMotion(report: (fast: boolean) => void): {
  step: (y: number, now: number) => void;
  dispose: () => void;
} {
  let fast = false;
  let primed = false;
  let lastY = 0;
  let lastMs = 0;
  let settleTimer = 0;
  const stop = (): void => {
    clearTimeout(settleTimer);
    if (!fast) return;
    fast = false;
    report(false);
  };
  const step = (y: number, now: number): void => {
    if (primed) {
      if (isFast(y, lastY, now - lastMs)) {
        if (!fast) {
          fast = true;
          report(true);
        }
        // A drag ends in a few small steps, so the window restarts on every fast one.
        clearTimeout(settleTimer);
        settleTimer = setTimeout(stop, SETTLE_MS);
      } else {
        stop();
      }
    }
    primed = true;
    lastY = y;
    lastMs = now;
  };
  return { step, dispose: () => clearTimeout(settleTimer) };
}
