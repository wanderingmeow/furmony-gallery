import { describe, expect, it } from 'vitest'
import {
  GAP, MIN_CARD, MIN_COLS, RELATED_CARD_GAP, RELATED_CARD_MIN, VIEW_PAD,
  detailBodyHeight, detailPictureHeight, indexOfRow, relatedCardWidth, relatedCardsHeight,
  relatedPerView, relatedStripHeight, rowOfIndex, type Shape, shapeAt, sheetCardBox, skeletonRows,
  waterfallCardWidth, waterfallCols, waterfallRowHeight,
} from './layout'

// Each grid answers two questions: how many cards fit, and how wide each one is. The
// named cases are the widths people actually get - a phone, a small window, and the
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
  // difference - a readable cover beats a whole card too small to judge.
  it('scrolls instead of shrinking below the floor', () => {
    const avail = 490
    expect(relatedPerView(avail)).toBe(3)
    expect(relatedCardWidth(avail, 3)).toBe(RELATED_CARD_MIN)
    expect(RELATED_CARD_MIN * 3 + RELATED_CARD_GAP * 2 - avail).toBe(18)
  })

  // Measured in the browser on a 430px sheet: 192px wide, 124.45px cover, 24px caption line.
  // The empty strip holds this plus the bar, so the sheet jumps when the number here and
  // a real card's height differ.
  it('matches the height a real card row takes', () => {
    expect(relatedCardsHeight(192)).toBeCloseTo(148.45, 1)
  })

  // This checks the sum. Whether the empty strip uses it is a browser check.
  it('adds the bar and its gap to the cards', () => {
    expect(relatedStripHeight(192)).toBeCloseTo(165.45, 1)
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

// The placeholder list draws the grid that the real list will use, so it needs the same number of
// rows that a reader would see filled: every row that starts above the fold. The cards start
// VIEW_PAD under the bar's bottom edge, which measures 110px.
describe('placeholder row math', () => {
  const topPad = 110 + VIEW_PAD
  const rowsAt = (viewportWidth: number, viewportHeight: number) => {
    const row = waterfallRowHeight(waterfallCardWidth(viewportWidth, waterfallCols(viewportWidth)))
    return skeletonRows(viewportHeight, topPad, row)
  }

  it('fills a 390x844 phone with 4 rows', () => {
    expect(rowsAt(390, 844)).toBe(4)
  })

  it('keeps the row that only shows its top edge', () => {
    // A 390px window's row pitch is 208.5, so the fourth row starts at 126 + 3 * 208.5 = 751.5.
    expect(skeletonRows(752, topPad, 208.5)).toBe(4)
    expect(skeletonRows(751, topPad, 208.5)).toBe(3)
  })

  it('draws one row in landscape, where the fold is shallower than a row', () => {
    expect(rowsAt(844, 390)).toBe(1)
  })

  it('keeps 4 rows on a 21:9 phone, where the extra height is not a whole row', () => {
    expect(rowsAt(390, 910)).toBe(4)
  })

  it('fills a 1280x800 window with 3 rows, and a 2560x1440 one with 6', () => {
    expect(rowsAt(1280, 800)).toBe(3)
    expect(rowsAt(2560, 1440)).toBe(6)
  })

  it('draws a row even when the window is shorter than the bar', () => {
    expect(skeletonRows(100, topPad, 208)).toBe(1)
  })
})

describe("the detail's shape and box", () => {
  // A screen splits when it is wide enough for two columns and wider than it is tall: a portrait
  // screen already has the height one column needs, and a split column would tower over any art.
  const screens: [string, number, number, Shape][] = [
    ['a phone held upright', 393, 852, 'sheet'],
    ['an iPhone SE sideways', 667, 375, 'panel'],
    ['a phone turned sideways', 852, 393, 'panel'],
    ['an iPad upright', 834, 1194, 'sheet'],
    ['an iPad mini sideways', 1133, 744, 'panel'],
    ['an iPad Pro upright', 1024, 1366, 'sheet'],
    ['an iPad Pro sideways', 1366, 1024, 'panel'],
    ['a laptop window', 1280, 800, 'panel'],
    ['a desktop screen', 1920, 1080, 'panel'],
    ['a square window', 900, 900, 'panel'],
    ['one pixel taller than wide', 900, 901, 'sheet'],
    ['the narrowest screen that splits', 640, 400, 'panel'],
    ['one pixel narrower', 639, 400, 'sheet'],
  ]

  it.each(screens)('%s', (_name, w, h, shape) => {
    expect(shapeAt(w, h)).toBe(shape)
  })

  it("stops a sheet's art near its own width, and gives a panel the whole column", () => {
    // A 1:1 picture fills these boxes instead of floating between two side bands.
    expect(detailPictureHeight(sheetCardBox(393, 852), 'sheet'), 'a phone').toBeCloseTo(397.1)
    expect(detailPictureHeight(sheetCardBox(1133, 744), 'panel'), 'an iPad mini sideways').toBe(548)
    expect(detailPictureHeight(sheetCardBox(852, 393), 'panel'), 'a phone sideways').toBe(245)
    expect(detailPictureHeight(sheetCardBox(700, 200), 'panel'), 'below this the zoom is how you look at it').toBe(120)
  })

  it("holds a sheet's art to half its card", () => {
    // A tablet upright has room for a cover that fills the card, and a reader who has to scroll past
    // it to reach the table.
    expect(detailPictureHeight(sheetCardBox(744, 1133), 'sheet'), 'an iPad mini upright').toBeCloseTo(542.5)
    expect(detailPictureHeight(sheetCardBox(1024, 1366), 'sheet'), 'an iPad Pro upright').toBeCloseTo(659)
    // A panel is two columns: the art's column is what it is, and the table stands beside it.
    expect(detailPictureHeight(sheetCardBox(1366, 1024), 'panel'), "a panel's own column").toBe(780)
  })

  it('caps the art so the table stays on the first screen', () => {
    // The room a sheet has left once its padding, the thumbs and the bar are paid for. A card this
    // short is under the cover's own ceiling, so the room is what decides.
    const box = sheetCardBox(393, 400)
    expect(detailPictureHeight(box, 'sheet')).toBe(box.h - 80 - 68 - 61)
  })

  it('sizes the card the way its classes draw it', () => {
    expect(sheetCardBox(393, 852), 'the whole screen below sm').toEqual({ w: 393, h: 852 })
    expect(sheetCardBox(744, 1133), 'a sheet stands 24 in from sm up').toEqual({ w: 696, h: 1085 })
    expect(sheetCardBox(1024, 1366), 'and stops at 760 wide').toEqual({ w: 760, h: 1318 })
    expect(sheetCardBox(852, 393), 'a screen this short keeps no gap').toEqual({ w: 852, h: 393 })
    expect(sheetCardBox(1133, 744)).toEqual({ w: 1080, h: 696 })
    expect(sheetCardBox(1366, 1024), 'a tall panel keeps a wider gap').toEqual({ w: 1080, h: 928 })
  })

  it('gives a panel the whole box, and a sheet the box less its padding', () => {
    expect(detailBodyHeight(sheetCardBox(1133, 744), 'panel')).toBe(696)
    expect(detailBodyHeight(sheetCardBox(852, 393), 'panel')).toBe(393)
    expect(detailBodyHeight(sheetCardBox(393, 852), 'sheet'), 'a sheet keeps its padding').toBe(772)
  })
})
