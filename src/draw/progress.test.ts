// Tests for the progress bar maths (progress.ts). No DOM, no reactivity.
import { describe, expect, it } from 'vitest'
import { scrollThumb } from './progress'

// 1000px of content in a 400px window, so the row can scroll 600px, on a 200px track.
// scrollThumb has no default floor, so these tests pass 24.
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
