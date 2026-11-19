// src/model/priceRange.ts - the price range filter: where a slider's ends may rest, which rows a
// range keeps, and what its two ends read as.
//
// The bins come from statistics.ts, so the panel's histogram and the stats page's chart agree on
// where a price sits. The slider rests on the bars' own edges, so the band covers whole bars and
// the reader can count what a drag takes in.
import type { AdoptListing } from './types'
import { displayPrice, formatPrice } from './domain'
import type { Bin } from './statistics'

/** The two ends in yuan. Both ends are inside the range. */
export type PriceRange = [number, number]

/** The widest range the list allows, or null when no listing has a price: a slider with nothing to
 *  slide over would offer a filter that hides every row. */
export function rangeExtent(edges: number[]): PriceRange | null {
  return edges.length >= 2 ? [edges[0], edges[edges.length - 1]] : null
}

const nearest = (edges: number[], value: number): number => {
  let best = 0
  for (let i = 1; i < edges.length; i += 1) {
    if (Math.abs(edges[i] - value) < Math.abs(edges[best] - value)) best = i
  }
  return best
}

/** Where a drag lands. The two ends keep at least one bar between them, so a band is never thinner
 *  than the bar it covers, and a thumb dragged past its neighbour stops beside it. */
export function snapRange(edges: number[], low: number, high: number): PriceRange | null {
  if (edges.length < 3) return null
  const last = edges.length - 1
  const lo = Math.min(Math.max(nearest(edges, low), 0), last - 1)
  let hi = Math.min(Math.max(nearest(edges, high), 1), last)
  if (hi <= lo) hi = lo + 1
  return [edges[lo], edges[hi]]
}

/** A listing with no price is outside every range: there is no number to compare it with. */
export function inPriceRange(price: number, range: PriceRange): boolean {
  return price > 0 && price >= range[0] && price <= range[1]
}

export function keepsByPrice(row: AdoptListing, range: PriceRange): boolean {
  return inPriceRange(displayPrice(row), range)
}

/** Whether the range still covers everything, which is the same as no range at all. */
export function isFullRange(range: PriceRange | null, extent: PriceRange | null): boolean {
  return !!range && !!extent && range[0] <= extent[0] && range[1] >= extent[1]
}

/** How many rows the range keeps. */
export function countInRange(rows: AdoptListing[], range: PriceRange): number {
  return rows.filter((l) => keepsByPrice(l, range)).length
}

/** The two ends in the money shape of the language on screen, which is the shape the cards use, so
 *  a price reads the same in both places. */
export function priceRangeLabel(range: PriceRange): string {
  return `${formatPrice(range[0])} - ${formatPrice(range[1])}`
}

/** Whether a bar sits inside the band, so the panel can paint it at full strength. A bar that only
 *  touches one end is out: its rows are out. */
export function barInside(bin: Bin, range: PriceRange): boolean {
  return bin.low >= range[0] && bin.high <= range[1]
}
