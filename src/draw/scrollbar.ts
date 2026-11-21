// Position maths for two things that move with a scroller: the progress bar under the related
// row, and the preview chip at the right edge of the waterfall.
//
// A separate module so the maths can be tested without a document.
import type { Scroller } from './fade'

export interface Thumb {
  /** width along the track, in px */
  width: number
  /** distance from the track's left edge, in px */
  offset: number
}

// The floor for a thumb's width. No engine reports the length it draws, so this number is ours to
// pick. The preview chip shares it, because the chip sits at the middle of the thumb.
const THUMB_MIN = 24

/**
 * The thumb for a row that scrolls, on a track `track` px wide. null when the content fits or
 * the track has no width.
 *
 * Width is the visible share of the content, scaled to the track, so a long list gets a short
 * thumb. `min` is the floor for that width, and a track narrower than `min` gives a thinner thumb,
 * since the thumb cannot exceed the track.
 */
export function scrollThumb(row: Scroller, track: number, min: number): Thumb | null {
  const rest = row.scrollWidth - row.clientWidth
  if (rest <= 0 || track <= 0) return null
  const width = Math.min(track, Math.max(min, (track * row.clientWidth) / row.scrollWidth))
  const progress = Math.min(1, Math.max(0, row.scrollLeft / rest))
  return { width, offset: progress * (track - width) }
}

/**
 * The other direction: the progress that puts the thumb's middle under `clientX`.
 *
 * Measure from the track's own left edge. A grab area that reaches past the track gives the thumb
 * its left edge under the pointer instead.
 */
export function pointerProgress(
  clientX: number,
  trackLeft: number,
  track: number,
  thumb: Thumb,
): number {
  const room = track - thumb.width
  if (room <= 0) return 0
  return Math.min(1, Math.max(0, (clientX - trackLeft - thumb.width / 2) / room))
}

/**
 * The y of the preview chip, at the middle of the scrollbar thumb. No browser reports where it
 * drew its own thumb, so the chip is placed from the same model the related row's bar uses: the
 * page becomes a scroller one screen plus `scrollRange` long, and the thumb is scaled to `track`
 * rather than to the page. WebKit insets its track and takes its floor from AppKit, so the chip sits
 * a little low at either end. null when the chip has nowhere to travel.
 */
export function previewTop(
  scrollTop: number, scrollRange: number, viewport: number,
  track: { top: number; bottom: number }, height: number,
): number | null {
  const room = track.bottom - track.top
  if (scrollRange < viewport || room < height) return null
  const thumb = scrollThumb(
    { scrollLeft: scrollTop, scrollWidth: viewport + scrollRange, clientWidth: viewport },
    room,
    THUMB_MIN,
  )
  if (!thumb) return null
  const center = thumb.offset + thumb.width / 2
  return track.top + Math.min(room - height, Math.max(0, center - height / 2))
}
