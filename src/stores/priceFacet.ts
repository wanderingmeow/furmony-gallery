// src/stores/priceFacet.ts - what the 价格区间 block reads: the bars, where a thumb may rest, and
// what the band keeps.
//
// Two row sets go in, and neither one runs with the band. A band that changed its own bars would
// move them while a thumb is mid-drag.
//
// A band can also reach past every price the tab holds, because the reader set it on another tab.
// Pulling it back would lay it over listings it never covered, so the block adds one empty bar
// beyond the end and lets the band sit there. The pair the reader chose stays in the store until
// they drag again.
import { createMemo, createSignal } from 'solid-js'
import type { AdoptListing } from '../model/types'
import { displayPrice } from '../model/domain'
import { priceBins, priceEdges, withEmptyBar, PRICE_BUCKET, type Bin, type EmptyBarSide } from '../model/statistics'
import { countInRange, isFullRange, rangeExtent, type PriceRange } from '../model/priceRange'

export interface PriceFacet {
  /** The bars, in blocks of `PRICE_BUCKET`, plus the empty bar while the block holds one. */
  bars: () => Bin[]
  /** The edges the bars are drawn between, which is where a thumb may rest. */
  steps: () => number[]
  /** The two outer edges of the grid, or null while the tab carries no price. This is what
   *  `isFullRange` measures a band against. */
  full: () => PriceRange | null
  /** Whether the stored pair narrows the list. A pair over everything narrows nothing. */
  on: () => boolean
  /** The band the list runs with: null while `on` is false. */
  effective: () => PriceRange | null
  /** How many rows the band keeps. */
  count: () => number
  /** Call when the block mounts. The block decides here whether to hold an empty bar, and keeps
   *  that shape until it mounts again. Taking a bar away mid-drag would move the grid. */
  remount: () => void
}

/**
 * What each input decides:
 *
 * - `tab` is the tab's list, with the band and the panel's picks left out. It sets the grid: where
 *   the bars start, where the ends may rest, and what counts as covering everything.
 * - `listed` is the list on screen, with the band left out. It sets the height of every bar and
 *   the count under the slider, so both follow the picks.
 * - `stored` is the pair the reader left in the panel, or null.
 *
 * Furmony leaves 0 where a listing has no price, so a row with no number joins no bar and falls
 * outside every band.
 */
export function createPriceFacet(
  tab: () => AdoptListing[],
  listed: () => AdoptListing[],
  stored: () => PriceRange | null,
): PriceFacet {
  const priced = (rows: AdoptListing[]) => rows.map(displayPrice).filter((p) => p > 0)
  // The tab's spread on its own, with no extra bar: this is what a band is measured against.
  const home = createMemo(() => rangeExtent(priceEdges(priceBins(priced(tab())))))
  const emptySide = createMemo<EmptyBarSide>(() => {
    const h = home()
    const r = stored()
    if (!h || !r) return 'none'
    if (r[1] > h[1]) return r[0] < h[0] ? 'both' : 'above'
    return r[0] < h[0] ? 'below' : 'none'
  })
  const [held, setHeld] = createSignal<EmptyBarSide>('none')
  const bars = createMemo(() =>
    withEmptyBar(priceBins(priced(listed()), PRICE_BUCKET, home()), PRICE_BUCKET, held()))
  const steps = createMemo(() => priceEdges(bars()))
  const full = createMemo(() => rangeExtent(steps()))
  const on = createMemo(() => {
    const r = stored()
    return !!r && !!full() && !isFullRange(r, full())
  })
  const effective = createMemo(() => (on() ? stored() : null))
  const count = createMemo(() => {
    const r = effective()
    return r ? countInRange(listed(), r) : 0
  })
  return { bars, steps, full, on, effective, count, remount: () => setHeld(emptySide()) }
}
