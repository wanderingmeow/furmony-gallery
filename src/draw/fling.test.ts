import { describe, expect, it } from 'vitest'
import {
  DISMISS_FLING, DISMISS_TRAVEL, FLING_WINDOW_MS, flingVelocity, shouldDismiss, type Sample,
} from './fling'

const steady = (pxPerMs: number, count = 8): Sample[] =>
  Array.from({ length: count }, (_, i) => ({ t: i * 20, y: i * 20 * pxPerMs }))

describe('flingVelocity', () => {
  it('is zero without enough history to measure', () => {
    expect(flingVelocity([], 1000)).toBe(0)
    expect(flingVelocity([{ t: 1000, y: 40 }], 1000)).toBe(0)
  })

  it('reads a steady downward drag', () => {
    const s = steady(0.5)
    expect(flingVelocity(s, s[s.length - 1].t)).toBeCloseTo(0.5, 6)
  })

  it('reads upward movement as negative', () => {
    const s = steady(-2)
    expect(flingVelocity(s, s[s.length - 1].t)).toBeCloseTo(-2, 6)
  })

  it('ignores samples older than the window', () => {
    // One interval, 500ms long: nothing in it is inside the window, so nothing moved.
    expect(flingVelocity([{ t: 0, y: 0 }, { t: 500, y: 10 }], 500)).toBe(0)
  })

  // Resting first and then flicking should read as the flick — that is the whole point of
  // measuring only the tail.
  it('measures the flick after a rest', () => {
    const s: Sample[] = [{ t: 0, y: 0 }, { t: 500, y: 0 }, { t: 560, y: 60 }, { t: 600, y: 120 }]
    expect(flingVelocity(s, 600)).toBeCloseTo(1.2, 6)
  })

  it('never reaches back further than the window allows', () => {
    const s = steady(1, 40)
    const last = s[s.length - 1].t
    const measured = flingVelocity(s, last)
    expect(measured).toBeCloseTo(1, 6)
    // The same samples read at half speed would need the window to cover them all.
    expect(FLING_WINDOW_MS).toBeLessThan(s[s.length - 1].t - s[0].t)
  })
})

describe('shouldDismiss', () => {
  it('closes on a long pull even without speed', () => {
    expect(shouldDismiss(DISMISS_TRAVEL + 0.01, 0)).toBe(true)
  })

  it('closes on a fast flick even without distance', () => {
    expect(shouldDismiss(0, DISMISS_FLING + 0.01)).toBe(true)
  })

  it('keeps the sheet open when neither reaches its threshold', () => {
    expect(shouldDismiss(DISMISS_TRAVEL, DISMISS_FLING)).toBe(false)
    expect(shouldDismiss(0.1, 0.05)).toBe(false)
  })
})
