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

/** Which end of the band a move or a read is about. */
export type PriceEnd = 'low' | 'high'

/** The price at one end of the band. */
export const edgeOf = (range: PriceRange, end: PriceEnd): number =>
  end === 'low' ? range[0] : range[1]

/** The end the finger is not on. */
export const otherEnd = (end: PriceEnd): PriceEnd => (end === 'low' ? 'high' : 'low')

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

const clamp = (index: number, low: number, high: number): number =>
  Math.min(Math.max(index, low), high)

/** Where a pair read back from storage rests: at least one bar between the ends, so a band is
 *  never thinner than the bar it covers. A pair can arrive collapsed, crossed, or from another
 *  tab's grid. A drag has its own rule in slideRange. */
export function snapRange(edges: number[], low: number, high: number): PriceRange | null {
  if (edges.length < 3) return null
  const last = edges.length - 1
  const lo = clamp(nearest(edges, low), 0, last - 1)
  const hi = Math.max(clamp(nearest(edges, high), 1, last), lo + 1)
  return [edges[lo], edges[hi]]
}

/** Where a drag leaves the pair. The end under the finger takes the nearest edge and the other
 *  keeps its own, so a drag that reaches its neighbor stops one bar short. Moving the neighbor
 *  too would let one thumb walk the whole band along the rail. */
export function slideRange(
  edges: number[],
  moving: PriceEnd,
  value: number,
  other: number,
): PriceRange | null {
  if (edges.length < 3) return null
  const last = edges.length - 1
  const hand = nearest(edges, value)
  if (moving === 'low') {
    const hi = clamp(nearest(edges, other), 1, last)
    const lo = clamp(Math.min(hand, hi - 1), 0, last - 1)
    return [edges[lo], edges[hi]]
  }
  const lo = clamp(nearest(edges, other), 0, last - 1)
  const hi = clamp(Math.max(hand, lo + 1), 1, last)
  return [edges[lo], edges[hi]]
}

/** The CSS thumb is 22px, so its center travels from half a thumb inside one end of the row to
 *  half a thumb inside the other. */
export const THUMB = 22

/** The index of an edge, or -1 when the price is not on this grid. */
export const stepIndex = (edges: number[], value: number): number => edges.indexOf(value)

/** How far along the rail, 0 to 1, an edge sits. */
export const railShare = (edges: number[], value: number): number =>
  stepIndex(edges, value) / (edges.length - 1)

/** The step a page coordinate presses on. A row no wider than a thumb has no travel to map. */
export function stepAt(
  edges: number[],
  box: { left: number; width: number },
  clientX: number,
): number {
  if (box.width <= THUMB) return 0
  const along = clamp((clientX - box.left - THUMB / 2) / (box.width - THUMB), 0, 1)
  return Math.round(along * (edges.length - 1))
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
