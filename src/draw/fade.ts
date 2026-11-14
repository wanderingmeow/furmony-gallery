// How dark each end of a scrolling row should look, shared by the related row and the
// filter tab row. The left follows how far the row has scrolled, the right follows how
// much is left to scroll.
//
// Each row draws these numbers its own way — the card row sits on a plain canvas and
// overlays a canvas-coloured gradient, while the tab row sits on .glass and can only mask
// its own content — so this module stops at the maths.

export interface EdgeFade {
  /** 0..1 opacity for the left edge */
  left: number
  /** 0..1 opacity for the right edge */
  right: number
}

export const NO_FADE: EdgeFade = { left: 0, right: 0 }

export interface Scroller {
  scrollLeft: number
  scrollWidth: number
  clientWidth: number
}

// Scroll events arrive far faster than the eye can follow, so a step of 5% costs one DOM
// write instead of one per pixel.
const STEPS = 20

/**
 * `range` is how many pixels the fade needs to reach 0. It has to be wider than one snap
 * step, or a snapping row only ever lands on full or gone and the middle never shows.
 */
export function edgeFade(el: Scroller, range: number): EdgeFade {
  if (range <= 0) return NO_FADE
  const strength = (px: number) => {
    const ratio = Math.min(1, Math.max(0, px / range))
    return Math.round(ratio * STEPS) / STEPS
  }
  return {
    left: strength(el.scrollLeft),
    right: strength(el.scrollWidth - el.scrollLeft - el.clientWidth),
  }
}

/** null means the row needs no mask, so the caller leaves the property off. */
export function fadeMask(fade: EdgeFade, px: number): string | null {
  if (fade.left === 0 && fade.right === 0) return null
  const l = fade.left > 0 ? `transparent 0px, #000 ${(fade.left * px).toFixed(1)}px` : '#000 0px'
  const r = fade.right > 0
    ? `#000 calc(100% - ${(fade.right * px).toFixed(1)}px), transparent 100%`
    : '#000 100%'
  return `linear-gradient(to right, ${l}, ${r})`
}
