// Position maths for two things that move with a scroller: the progress bar under the related
// row, and the preview chip at the right edge of the waterfall.
//
// The rows could do this maths inline. It is a separate module so the tests can check it
// without a document and without mounting a row of covers.
import type { Scroller } from './fade'

export interface Thumb {
  /** width along the track, in px */
  width: number
  /** distance from the track's left edge, in px */
  offset: number
}

// No engine reports the thumb length it uses, so this floor is ours to pick. Browsers stop
// shortening a thumb at some point, and the chip needs the same limit.
const THUMB_MIN = 24

/**
 * The thumb for a row that scrolls, on a track `track` px wide. null when the content fits
 * and there is nothing to scroll.
 *
 * Width is the visible share of the content, scaled to the track, so a long list gets a
 * short thumb. `min` is the floor for that width. A track narrower than `min` gives a
 * thinner thumb, since the thumb cannot exceed the track. `track` and `min` come from the
 * caller: they belong to the layout.
 */
export function scrollThumb(row: Scroller, track: number, min: number): Thumb | null {
  const rest = row.scrollWidth - row.clientWidth
  if (rest <= 0 || track <= 0) return null
  const width = Math.min(track, Math.max(min, (track * row.clientWidth) / row.scrollWidth))
  const progress = Math.min(1, Math.max(0, row.scrollLeft / rest))
  return { width, offset: progress * (track - width) }
}

/**
 * The y of the preview chip, placed at the middle of the scrollbar thumb. Nothing reports where
 * the browser drew that thumb, so the model here is our own: the track is the window, the thumb
 * takes the visible share of the page, and THUMB_MIN is the floor. WebKit keeps its track away
 * from the edges and takes its floor from AppKit, so the chip sits a little low near the two
 * ends there.
 *
 * null when the page has less than one screen of scroll. A short list would otherwise move the
 * chip the whole way down the edge on a few px of scroll, which looks like a jump.
 */
export function previewTop(
  scrollTop: number, scrollable: number, viewport: number, height: number,
): number | null {
  if (scrollable < viewport) return null
  const thumb = Math.max(THUMB_MIN, (viewport * viewport) / (viewport + scrollable))
  const ratio = Math.min(1, Math.max(0, scrollTop / scrollable))
  const centre = ratio * (viewport - thumb) + thumb / 2
  return Math.min(viewport - height, Math.max(0, centre - height / 2))
}
