// Tests for the scrollbar maths (scrollbar.ts). No DOM, no reactivity.
import { describe, expect, it } from 'vitest'
import { pointerProgress, previewTop, scrollThumb } from './scrollbar'

// 1000px of content in a 400px window, so the row can scroll 600px, on a 200px track.
// scrollThumb has no default floor, so these tests pass 24.
const TRACK_LEFT = 1000
const at = (scrollLeft: number, track = 200, min = 24) =>
  scrollThumb({ scrollLeft, scrollWidth: 1000, clientWidth: 400 }, track, min)

describe('scrollThumb', () => {
  it('is a quarter of the track, at its left, when a quarter is visible', () => {
    expect(at(0)).toEqual({ width: 80, offset: 0 })
  })

  it('ends flush with the right edge', () => {
    expect(at(600)).toEqual({ width: 80, offset: 120 })
  })

  it('moves in proportion to the scroll', () => {
    expect(at(300)).toEqual({ width: 80, offset: 60 })
  })

  it('holds the thumb of a long list at the floor', () => {
    // 4000px of content in a 400px window would put the thumb at 20px on a 200px track.
    const row = (scrollLeft: number) => ({ scrollLeft, scrollWidth: 4000, clientWidth: 400 })
    expect(scrollThumb(row(0), 200, 24)).toEqual({ width: 24, offset: 0 })
    expect(scrollThumb(row(3600), 200, 24)).toEqual({ width: 24, offset: 176 })
  })

  it('fits the thumb into a track narrower than the floor', () => {
    // A 20px track cannot hold a 24px thumb, so the thumb is 20px wide and cannot move.
    expect(at(600, 20)).toEqual({ width: 20, offset: 0 })
  })

  it('shows nothing where there is nothing to scroll', () => {
    expect(scrollThumb({ scrollLeft: 0, scrollWidth: 400, clientWidth: 400 }, 200, 24)).toBeNull()
    expect(scrollThumb({ scrollLeft: 0, scrollWidth: 1000, clientWidth: 400 }, 0, 24)).toBeNull()
  })

  it('clamps a row dragged past either end', () => {
    // Written as literals. Two calls of the same function return the same value when the
    // clamp is wrong, so comparing them proves nothing.
    expect(at(5000)).toEqual({ width: 80, offset: 120 })
    expect(at(-50)).toEqual({ width: 80, offset: 0 })
  })
})

describe('pointerProgress', () => {
  // The two directions have to agree, or the thumb jumps out from under the hand that grabs it.
  it('agrees with scrollThumb about where a grab lands', () => {
    for (const scrollLeft of [0, 150, 300, 600]) {
      const thumb = at(scrollLeft)
      expect(thumb, 'the row scrolls, so there is a thumb').not.toBeNull()
      const t = thumb!
      const clientX = TRACK_LEFT + t.offset + t.width / 2
      const progress = pointerProgress(clientX, TRACK_LEFT, 200, t)
      expect(progress * 600, `a grab at the middle of the thumb at ${scrollLeft}px`).toBeCloseTo(scrollLeft, 5)
    }
  })

  it('keeps a pointer outside the track at either end', () => {
    const thumb = { width: 80, offset: 0 }
    expect(pointerProgress(TRACK_LEFT - 12, TRACK_LEFT, 200, thumb)).toBe(0)
    expect(pointerProgress(TRACK_LEFT + 212, TRACK_LEFT, 200, thumb)).toBe(1)
  })

  it('has nowhere to go when the thumb is the whole track', () => {
    expect(pointerProgress(TRACK_LEFT + 100, TRACK_LEFT, 200, { width: 200, offset: 0 })).toBe(0)
  })
})

describe('previewTop', () => {
  // A 3200px page in an 800px window leaves 2400px of scroll. The thumb takes the visible
  // share: 800 * 800 / 3200 = 200px, so its center runs from 100px to 700px.
  const at = (scrollTop: number, scrollRange = 2400) => previewTop(scrollTop, scrollRange, 800, 36)

  it('sits on the middle of the thumb, at the top', () => {
    expect(at(0)).toBe(82)
  })

  it('sits on the middle of the thumb, at the bottom', () => {
    expect(at(2400)).toBe(682)
  })

  it('holds the middle of the edge at the middle of the page', () => {
    expect(at(1200)).toBe(382)
  })

  it('is null until the page has one full screen of scroll', () => {
    expect(at(200, 799)).toBeNull()
    expect(at(200, 0)).toBeNull()
    expect(at(1200, 2400)).toBe(382)
  })

  it('stays on the thumb when the page is long and the thumb is at its floor', () => {
    // 100800px of page puts the thumb at the 24px floor, so the chip can reach both ends.
    expect(at(0, 100000)).toBe(0)
    expect(at(50000, 100000)).toBe(382)
    expect(at(100000, 100000)).toBe(764)
  })

  it('keeps a scroll past the end on the last thumb position', () => {
    expect(at(9000)).toBe(682)
  })

  it('centers the chip when the window is shorter than the thumb floor', () => {
    // A thumb cannot run longer than its track. That is the rule scrollThumb follows and the one
    // the chip's own copy of the maths broke: a 20px window measured a 24px thumb, so the top of
    // the page and the bottom of it landed 4px apart instead of both on the middle of the edge.
    expect(previewTop(0, 200, 20, 8)).toBe(6)
    expect(previewTop(200, 200, 20, 8)).toBe(6)
  })
})
