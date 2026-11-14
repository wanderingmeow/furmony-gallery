import { describe, expect, it } from 'vitest'
import {
  GAP, MIN_CARD, MIN_COLS, RELATED_CARD_GAP, RELATED_CARD_MIN, VIEW_PAD,
  indexOfRow, relatedCardWidth, relatedPerView, relatedRowHeight, rowOfIndex,
  waterfallCardWidth, waterfallCols, waterfallRowHeight,
} from './layout'

// Each grid answers two questions: how many cards fit, and how wide each one is. The
// named cases are the widths people actually get — a phone, a small window, and the
// detail sheet at its widest.
describe('related row column math', () => {
  const rowAt = (sheetWidth: number) => {
    const avail = sheetWidth - VIEW_PAD * 2
    const n = relatedPerView(avail)
    return { n, card: relatedCardWidth(avail, n) }
  }

  it('shows 2 cards on a 430px phone', () => {
    expect(rowAt(430)).toEqual({ n: 2, card: 192 })
  })

  // 760px is the widest the strip ever gets: the sheet stops at sm:max-w-190, so a
  // desktop window does not make the cards wider.
  it('shows 4 cards in a 760px sheet', () => {
    expect(rowAt(760)).toEqual({ n: 4, card: 171 })
  })

  it('shows 3 cards in between', () => {
    expect(rowAt(560)).toEqual({ n: 3, card: 166 })
  })

  it('never squeezes a cover below the floor', () => {
    // at 320px three cards would give 88px each, so the floor wins
    expect(rowAt(320).card).toBe(RELATED_CARD_MIN)
  })

  it('stays between 2 and 4 cards at any width', () => {
    for (let w = 240; w <= 2000; w += 10) {
      const n = relatedPerView(w - VIEW_PAD * 2)
      expect(n).toBeGreaterThanOrEqual(2)
      expect(n).toBeLessThanOrEqual(4)
    }
  })

  // Two outcomes only: the cards fit, or the floor holds them up.
  it('either fits whole cards or sits on the floor', () => {
    for (let avail = 200; avail <= 1400; avail += 1) {
      const n = relatedPerView(avail)
      const card = relatedCardWidth(avail, n)
      expect(card * n + RELATED_CARD_GAP * (n - 1) <= avail || card === RELATED_CARD_MIN).toBe(true)
    }
  })

  // One narrow band shows what that trade costs: a sheet of 517..539px asks for 3 cards,
  // and 3 cards at the floor need 508px. The floor wins, and the row scrolls by the
  // difference — a readable cover beats a whole card too small to judge.
  it('scrolls instead of shrinking below the floor', () => {
    const avail = 490
    expect(relatedPerView(avail)).toBe(3)
    expect(relatedCardWidth(avail, 3)).toBe(RELATED_CARD_MIN)
    expect(RELATED_CARD_MIN * 3 + RELATED_CARD_GAP * 2 - avail).toBe(18)
  })

  // The empty state reserves this height. If it drifts from the real card, the sheet
  // content jumps when 只看未锁定 filters the row down to nothing. Measured against the
  // real card on a 430px sheet: 192px wide, 124.45px cover, 24px caption line.
  it('reserves the height a real card row takes', () => {
    expect(relatedRowHeight(192)).toBeCloseTo(148.45, 1)
  })

  it('keeps the waterfall floor above the related row floor', () => {
    // a waterfall card carries a name, tags, and a price, so it needs more width than a
    // cover-only card
    expect(MIN_CARD).toBeGreaterThan(RELATED_CARD_MIN)
  })
})

describe('waterfall column math', () => {
  const gridAt = (viewportWidth: number) => {
    const cols = waterfallCols(viewportWidth)
    return { cols, card: waterfallCardWidth(viewportWidth, cols) }
  }

  it('shows 2 columns on a 430px phone', () => {
    expect(gridAt(430)).toEqual({ cols: 2, card: 191 })
  })

  // An unmeasured window is the first frame, and the first frame is a phone.
  it('falls back to 2 columns before the first measure', () => {
    expect(waterfallCols(0)).toBe(MIN_COLS)
  })

  it('adds a column as the window widens', () => {
    expect(waterfallCols(560)).toBe(2)
    expect(waterfallCols(760)).toBe(3)
    expect(waterfallCols(1200)).toBe(4)
  })

  // Card width stays fractional, so the cards and gaps fill the content box exactly and
  // no sliver of padding survives at the right edge.
  it('fills the width with cards and gaps', () => {
    for (let w = 320; w <= 2000; w += 5) {
      const { cols, card } = gridAt(w)
      expect(card * cols + GAP * (cols - 1)).toBeCloseTo(w - 2 * VIEW_PAD, 6)
    }
  })

  it('never draws fewer than 2 columns', () => {
    for (let w = 0; w <= 2400; w += 5) {
      expect(waterfallCols(w)).toBeGreaterThanOrEqual(MIN_COLS)
    }
  })

  // The MIN_CARD promise holds once the grid has room for two such cards. Below that the
  // clamp to 2 columns decides the width, and a phone gets a narrower card.
  it('keeps a card near MIN_CARD once two columns fit', () => {
    for (let w = 520; w <= 2400; w += 5) {
      expect(gridAt(w).card).toBeGreaterThan(MIN_CARD - GAP)
    }
  })

  it('pitches rows one card plus one gap apart', () => {
    const row = waterfallRowHeight(191)
    const card = row - GAP
    expect(row - card).toBe(GAP)
    // the estimate leaves room under the cover for the price, name, and tag lines
    expect(card).toBeGreaterThan(191 * 597 / 921)
  })

  // The saved scroll position stores an item, and items move between rows whenever the
  // filter changes, so both directions of this pair need to agree.
  it('maps an item to its row and back inside the same row', () => {
    const cols = 3
    const count = 50
    for (let i = 0; i < count; i++) {
      const first = indexOfRow(rowOfIndex(i, cols), cols, count)
      expect(first).toBeLessThanOrEqual(i)
      expect(first).toBeGreaterThan(i - cols)
    }
  })

  it('reads a missing item as the first row, and an empty view as no item', () => {
    expect(rowOfIndex(-1, 3)).toBe(0) // findIndex returns -1 when the filter hid the row
    expect(indexOfRow(0, 3, 0)).toBe(-1) // items()[-1] is undefined, and the caller checks
  })
})
