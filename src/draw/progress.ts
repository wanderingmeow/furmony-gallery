// The thumb of the progress bar under the related row: its width and its position along the
// track.
//
// The row could do this maths inline. It is a separate module so the tests can check it
// without a document and without mounting a row of covers.

import type { Scroller } from './fade'

export interface Thumb {
  /** width along the track, in px */
  width: number
  /** distance from the track's left edge, in px */
  offset: number
}

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
