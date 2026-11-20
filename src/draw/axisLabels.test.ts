import { describe, expect, it } from 'vitest'
import { axisRoom, axisWords, elide, measureDepth, measureLabel, tiltFor, wordRoom } from './axisLabels'

// The words here are all CJK, so a real canvas and the no-canvas fallback measure them the same.
const WORD = measureLabel('神秘生物')
const DEPTH = measureDepth()

describe('measureLabel / measureDepth', () => {
  it('grows with the word', () => {
    expect(measureLabel('神秘生物')).toBeGreaterThan(measureLabel('神秘'))
    expect(measureLabel('')).toBe(0)
  })

  it('measures a Latin word narrower than the same count of CJK glyphs', () => {
    expect(measureLabel('Dragon')).toBeLessThan(measureLabel('神秘生物'))
  })

  it('measures the ink the engine draws', () => {
    expect(DEPTH).toBeGreaterThan(0)
    expect(DEPTH).toBeLessThanOrEqual(12)
  })
})

describe('tiltFor', () => {
  it('stays flat while each word fits the bar it stands on', () => {
    expect(tiltFor(['龙', '狼', '猫'], 14)).toBe(0)
  })

  it('tilts 45° once a strip at 45° clears its neighbor', () => {
    expect(tiltFor(['神秘生物', '龙'], 30)).toBe(45)
  })

  it('stands the words up when even 45° would overlap them', () => {
    expect(tiltFor(['神秘生物', '龙'], 12.3)).toBe(90)
  })

  it('says nothing while the plot has no width to compare against', () => {
    expect(tiltFor(['神秘生物'], 0)).toBe(0)
  })
})

describe('the band', () => {
  it('is the longest word drop plus the gap and the letters', () => {
    expect(axisRoom(['龙', '神秘生物'], 90, 80)).toBe(Math.ceil(WORD + 10))
  })

  it('is capped at what the chart is willing to give', () => {
    expect(axisRoom(['Mysterious creature'], 90, 52)).toBe(52)
  })

  it('is shallower at 45° than at 90°', () => {
    expect(axisRoom(['神秘生物'], 45, 80)).toBeLessThan(axisRoom(['神秘生物'], 90, 80))
  })

  it('measures along the tilt, so 45° words may run longer', () => {
    expect(wordRoom(52, 45)).toBeGreaterThan(wordRoom(52, 90))
  })
})

describe('elide', () => {
  it('leaves a word that fits alone', () => {
    expect(elide('神秘生物', WORD)).toBe('神秘生物')
  })

  it('keeps what fits and marks the cut', () => {
    expect(elide('神秘生物', WORD - 10)).toBe('神秘…')
  })

  it('falls back to the ellipsis when nothing of the word fits', () => {
    expect(elide('神秘生物', 15)).toBe('…')
  })

  it('cuts after a whole word rather than through one', () => {
    expect(elide('Eastern dragon', 50)).toBe('Eastern…')
  })
})

describe('axisWords', () => {
  it('names every bar at 90° once the strips seat', () => {
    expect(axisWords(['神秘生物', '龙', '狼'], [0, 12.3, 24.6], 12.3, 90, 52))
      .toEqual(['神秘生物', '龙', '狼'])
  })

  it('cuts a word to the band the axis was given', () => {
    const [first] = axisWords(['Mysterious creature'], [0], 12.3, 90, 52)
    expect(first.endsWith('…')).toBe(true)
    expect(measureLabel(first)).toBeLessThanOrEqual(wordRoom(52, 90))
  })

  it('leaves a bar unnamed only when its strip would overlap the one kept', () => {
    expect(axisWords(['龙', '狼', '犬'], [0, 8, 16], 8, 90, 52)).toEqual(['龙', '', '犬'])
  })

  it('cuts a flat axis to the width of one bar', () => {
    expect(axisWords(['神秘生物'], [0], 25, 0, 52)).toEqual(['神…'])
  })

  it('asks for no room on a bar it left blank', () => {
    expect(axisWords(['龙', '', '犬'], [0, 8, 12], 12, 90, 52)).toEqual(['龙', '', '犬'])
  })
})
