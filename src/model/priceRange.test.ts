// Functional tests for the price range rules (priceRange.ts). No reactivity, no I/O.
import { describe, expect, it } from 'vitest'
import {
  barInside, countInRange, edgeOf, inPriceRange, isFullRange, keepsByPrice, otherEnd, priceRangeLabel,
  railShare, rangeExtent, slideRange, snapRange, stepAt, stepIndex,
} from './priceRange'
import { PRICE_BUCKET, priceBins, priceEdges } from './statistics'
import type { AdoptListing } from './types'

function listing(id: number, price?: number): AdoptListing {
  return { adoptId: id, paintersId: 1, productId: 1, nonrecurringExpense: price }
}

// A coarse grid keeps the snap rules readable. The panel's own grid is the one in the describe
// below.
const STEPS = [2000, 4000, 6000, 8000]

const edgesOf = (prices: number[]) => priceEdges(priceBins(prices))

describe('the grid the panel draws on', () => {
  it('bars are ¥1000 wide', () => {
    const bins = priceBins([2000, 4000, 8000])
    expect(bins.map((b) => b.high - b.low)).toEqual(bins.map(() => PRICE_BUCKET))
  })

  it('the slider rests on the bars own edges', () => {
    expect(priceEdges(priceBins([2000, 4000, 8000])))
      .toEqual([2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000])
  })

  it('spans the first edge to the last', () => {
    expect(rangeExtent(STEPS)).toEqual([2000, 8000])
  })

  it('has no extent when no listing has a price', () => {
    expect(rangeExtent(edgesOf([0, 0]))).toBeNull()
    expect(rangeExtent([])).toBeNull()
  })
})

describe('snapRange', () => {
  it('moves each end to the edge nearest it', () => {
    expect(snapRange(STEPS, 2600, 9400)).toEqual([2000, 8000])
    expect(snapRange(STEPS, 3100, 7100)).toEqual([4000, 8000])
  })

  it('keeps one bar between the ends', () => {
    expect(snapRange(STEPS, 5900, 6100)).toEqual([6000, 8000])
  })

  it('widens a pair that arrived crossed', () => {
    expect(snapRange(STEPS, 9000, 3000)).toEqual([6000, 8000])
  })

  it('holds one bar when both ends are dragged to the cheap end', () => {
    expect(snapRange(STEPS, 2000, 2000)).toEqual([2000, 4000])
  })

  it('has nothing to snap to below three edges', () => {
    expect(snapRange([2000, 4000], 2000, 4000)).toBeNull()
  })
})

describe('slideRange', () => {
  it('holds the neighbor while the other end travels', () => {
    expect(slideRange(STEPS, 'low', 2000, 6000)).toEqual([2000, 6000])
    expect(slideRange(STEPS, 'high', 8000, 4000)).toEqual([4000, 8000])
  })

  // The one-bar pair is the case a reader drags most: the far end stays where it is.
  it('stops the dragged end beside its neighbor', () => {
    expect(slideRange(STEPS, 'low', 6000, 6000)).toEqual([4000, 6000])
    expect(slideRange(STEPS, 'low', 8000, 6000)).toEqual([4000, 6000])
    expect(slideRange(STEPS, 'high', 4000, 4000)).toEqual([4000, 6000])
    expect(slideRange(STEPS, 'high', 2000, 4000)).toEqual([4000, 6000])
  })

  it('keeps one bar when the pair already sits at an end of the rail', () => {
    expect(slideRange(STEPS, 'high', 2000, 2000)).toEqual([2000, 4000])
    expect(slideRange(STEPS, 'low', 8000, 8000)).toEqual([6000, 8000])
  })

  it('has nothing to slide over below three edges', () => {
    expect(slideRange([2000, 4000], 'low', 2000, 4000)).toBeNull()
  })
})

describe('the rail a thumb travels', () => {
  // A row 244px wide: half a thumb (11px) in from each end is where a thumb's center may sit.
  const ROW = { left: 100, width: 244 }

  it('reads a press as the step it lands on', () => {
    expect(stepAt(STEPS, ROW, 111)).toBe(0)
    expect(stepAt(STEPS, ROW, 100 + 11 + 222 / 3)).toBe(1)
    expect(stepAt(STEPS, ROW, 100 + 11 + 222 * (2 / 3))).toBe(2)
    expect(stepAt(STEPS, ROW, 344)).toBe(3)
  })

  it('keeps a press that strays past the row on the end it came from', () => {
    expect(stepAt(STEPS, ROW, 0)).toBe(0)
    expect(stepAt(STEPS, ROW, 900)).toBe(3)
  })

  it('has nothing to map on a row no wider than a thumb', () => {
    expect(stepAt(STEPS, { left: 0, width: 22 }, 11)).toBe(0)
  })

  it('places an edge along the rail from 0 to 1', () => {
    expect(railShare(STEPS, 2000)).toBe(0)
    expect(railShare(STEPS, 4000)).toBeCloseTo(1 / 3)
    expect(railShare(STEPS, 8000)).toBe(1)
    expect(stepIndex(STEPS, 5000)).toBe(-1)
  })

  it('names the end the other one is not', () => {
    expect(edgeOf([2000, 6000], 'low')).toBe(2000)
    expect(edgeOf([2000, 6000], 'high')).toBe(6000)
    expect(otherEnd('low')).toBe('high')
  })
})

describe('inPriceRange', () => {
  it('includes both ends', () => {
    expect(inPriceRange(2000, [2000, 4000])).toBe(true)
    expect(inPriceRange(4000, [2000, 4000])).toBe(true)
  })

  it('keeps the rows between the ends and drops the rows outside', () => {
    expect(inPriceRange(3999, [2000, 4000])).toBe(true)
    expect(inPriceRange(1999, [2000, 4000])).toBe(false)
    expect(inPriceRange(4001, [2000, 4000])).toBe(false)
  })

  it('drops a listing with no price, because there is no number to compare', () => {
    expect(inPriceRange(0, [0, 10000])).toBe(false)
  })
})

describe('the list side', () => {
  const rows = [listing(1, 3000), listing(2, 9000), listing(3, 0)]

  it('keeps the rows whose price is inside', () => {
    expect(keepsByPrice(rows[0], [2000, 4000])).toBe(true)
    expect(keepsByPrice(rows[1], [2000, 4000])).toBe(false)
  })

  it('counts what the range keeps', () => {
    expect(countInRange(rows, [2000, 4000])).toBe(1)
  })

  it('reads a range that still covers everything as no range', () => {
    const full = rangeExtent(edgesOf([3000, 9000]))
    expect(isFullRange([2000, 10000], full)).toBe(true)
    expect(isFullRange([4000, 10000], full)).toBe(false)
    expect(isFullRange(null, full)).toBe(false)
  })
})

describe('what the panel shows', () => {
  it('reads the two ends the way the cards read a price', () => {
    expect(priceRangeLabel([28000, 45000])).toBe('¥28000 - ¥45000')
  })

  it('paints a bar at full strength only when the range holds all of it', () => {
    const [first, , last] = priceBins([2500, 6500])
    expect(barInside(first, [2000, 8000])).toBe(true)
    // The range opens inside the first bar, so part of that bar's rows are out.
    expect(barInside(first, [3000, 8000])).toBe(false)
    expect(barInside(last, [3000, 8000])).toBe(true)
  })
})
