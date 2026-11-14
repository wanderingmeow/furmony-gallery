// The maths behind the down-drag that closes a sheet: when did the finger move fast
// enough, or far enough, to count as closing it?

export type Sample = { t: number; y: number }

/**
 * Only the tail of the drag decides whether it was a fling, so an early slow slide does
 * not drag the speed down.
 */
export const FLING_WINDOW_MS = 120

/**
 * Touch samples kept. At 60Hz that is about 160ms of dragging, which still covers the
 * window above; a slower finger keeps a longer stretch.
 */
export const MAX_SAMPLES = 10

/** How far down, as a fraction of the sheet's height, counts as decided on its own. */
export const DISMISS_TRAVEL = 0.35

/** Or how fast it was released (px per ms), even if it barely moved. */
export const DISMISS_FLING = 0.35

/**
 * Speed over the tail of the drag, px per ms, positive meaning downward. Measured from the
 * oldest sample still inside the window, so a finger that rested and then flicked reads as
 * the flick.
 */
export function flingVelocity(samples: readonly Sample[], now: number): number {
  if (samples.length < 2) return 0
  let i = samples.length - 1
  while (i > 0 && now - samples[i - 1].t <= FLING_WINDOW_MS) i--
  const latest = samples[samples.length - 1]
  const earliest = samples[i]
  const dt = latest.t - earliest.t
  return dt > 0 ? (latest.y - earliest.y) / dt : 0
}

/** Pulling far enough or flinging fast enough each closes on its own. */
export function shouldDismiss(travel: number, velocity: number): boolean {
  return travel > DISMISS_TRAVEL || velocity > DISMISS_FLING
}
