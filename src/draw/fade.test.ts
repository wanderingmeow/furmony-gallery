// Tests for the shared edge-fade maths (fade.ts). No DOM, no reactivity.
import { describe, expect, it } from 'vitest'
import { edgeFade, fadeMask, NO_FADE } from './fade'

// 1000px of content in a 400px window, so the row can scroll 600px.
const at = (scrollLeft: number, range = 100) =>
  edgeFade({ scrollLeft, scrollWidth: 1000, clientWidth: 400 }, range)

describe('edgeFade', () => {
  it('is empty on the left and full on the right at the start', () => {
    expect(at(0)).toEqual({ left: 0, right: 1 })
  })

  it('reverses at the far end', () => {
    expect(at(600)).toEqual({ left: 1, right: 0 })
  })

  it('tapers proportionally as you approach the end', () => {
    expect(at(500).right).toBe(1)     // 100px left is a whole range: nothing to fade yet
    expect(at(550).right).toBe(0.5)   // half a range left
    expect(at(575).right).toBe(0.25)
    expect(at(595).right).toBe(0.05)
  })

  it('clamps instead of going out of bounds', () => {
    expect(at(-50)).toEqual({ left: 0, right: 1 })
    expect(at(5000)).toEqual({ left: 1, right: 0 })
  })

  it('shows nothing on a row that does not overflow', () => {
    expect(edgeFade({ scrollLeft: 0, scrollWidth: 300, clientWidth: 400 }, 100))
      .toEqual({ left: 0, right: 0 })
  })

  it('quantises to 5% steps so scrolling does not spam the DOM', () => {
    for (const px of [11, 17, 23, 29]) {
      expect(at(px).left * 20 % 1).toBeCloseTo(0, 9)
    }
  })

  // scrollLeft 0 over range 0 used to divide 0 by 0 and hand back NaN, which the caller
  // then wrote into a style as "opacity: NaN".
  it('fades nothing when the row has no fade distance', () => {
    for (const range of [0, -10]) {
      expect(edgeFade({ scrollLeft: 0, scrollWidth: 300, clientWidth: 400 }, range)).toBe(NO_FADE)
      expect(at(100, range)).toBe(NO_FADE)
    }
  })
})

describe('fadeMask', () => {
  it('returns nothing when neither side needs a fade', () => {
    expect(fadeMask(NO_FADE, 40)).toBeNull()
  })

  it('fades only the right side at the start', () => {
    const m = fadeMask({ left: 0, right: 1 }, 40)!
    expect(m).toContain('#000 0px')
    expect(m).toContain('calc(100% - 40.0px), transparent 100%')
  })

  it('fades both sides in the middle', () => {
    const m = fadeMask({ left: 1, right: 1 }, 40)!
    expect(m).toContain('transparent 0px, #000 40.0px')
    expect(m).toContain('calc(100% - 40.0px), transparent 100%')
  })

  it('shrinks the band as the fade weakens', () => {
    const m = fadeMask({ left: 0.5, right: 0 }, 40)!
    expect(m).toContain('#000 20.0px')
    expect(m).toContain('#000 100%')
  })
})
