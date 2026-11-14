// src/draw/anim.ts — timing shared by the detail sheet animations.
//
// Opening another setting starts three animations: the sheet slides in, the content
// scrolls to the top, and InfoTable changes height. One duration and one curve end them
// together; two durations look like two jumps.

export const SHEET_MOVE_MS = 240

export const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

/**
 * The OS "reduce motion" switch. Ask where the animation starts rather than caching it at
 * mount: the setting can change while the app stays open.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const bez = (t: number, a: number, b: number): number => {
  const u = 1 - t
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t
}

/** The JS version of EASE: find the Bézier parameter for x by bisection, then return
 *  the y at that parameter. */
export function ease(x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  let lo = 0
  let hi = 1
  let t = x
  for (let i = 0; i < 20; i++) {
    t = (lo + hi) / 2
    if (bez(t, 0.2, 0.2) < x) lo = t
    else hi = t
  }
  return bez(t, 0.8, 1)
}
