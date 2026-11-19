// 价格区间: what the block draws from the bins it is handed, and what a drag sends back. The rules
// behind it (where an end lands, which rows a range keeps) are in model/priceRange.test.ts.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'solid-js/web'
import { PriceRangeBlock } from './PriceRange'
import type { Bin } from '../../model/statistics'
import type { PriceRange } from '../../model/priceRange'

// Three bins and the edges between them. A thumb rests on an edge, never between two bars.
const EDGES = [20000, 22000, 24000, 26000]
const BINS: Bin[] = [
  { label: '20-22', count: 2, low: 20000, high: 22000 },
  { label: '22-24', count: 9, low: 22000, high: 24000 },
  { label: '24-26', count: 1, low: 24000, high: 26000 },
]

const facts = vi.hoisted(() => ({
  range: null as PriceRange | null,
  on: false,
  count: 0,
  bins: [] as Bin[],
  edges: [] as number[],
  full: null as PriceRange | null,
}))
const calls = vi.hoisted(() => [] as string[])
const mounts = vi.hoisted(() => ({ n: 0 }))

vi.mock('../../stores/derivedStore', () => ({
  price: {
    bars: () => facts.bins,
    steps: () => facts.edges,
    full: () => facts.full,
    on: () => facts.on,
    count: () => facts.count,
    // The block takes its grid shape from the facet as it starts, so a test can see that call.
    remount: () => { mounts.n += 1 },
  },
}))
vi.mock('../../stores/filterStore', () => ({
  priceRange: () => facts.range,
  setPriceRange: (v: PriceRange | null) => { calls.push(v ? `price:${v[0]}-${v[1]}` : 'price:null') },
}))

// One empty bar above the top. A band that this list cannot hold sits there.
const EMPTY_BAR: Bin = { label: '26-28', count: 0, low: 26000, high: 28000 }

let dispose: (() => void) | undefined
let host: HTMLDivElement

/** The facts are read once per render, so a test sets them and draws again. `priced` says whether
 *  the shelf carries prices at all. */
function draw(priced = true, emptyBar = false): void {
  dispose?.()
  host?.remove()
  calls.length = 0
  mounts.n = 0
  Object.assign(facts, priced
    ? emptyBar
      ? { bins: [...BINS, EMPTY_BAR], edges: [...EDGES, 28000], full: [20000, 28000] as PriceRange }
      : { bins: BINS, edges: EDGES, full: [EDGES[0], EDGES[EDGES.length - 1]] as PriceRange }
    : { bins: [], edges: [], full: null })
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(() => <PriceRangeBlock />, host)
}

const thumbs = () => Array.from(host.querySelectorAll<HTMLInputElement>('input[type="range"]'))
const drag = (which: number, value: number) => {
  const el = thumbs()[which]
  el.value = String(value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

afterEach(() => {
  dispose?.()
  host?.remove()
  facts.range = null
  facts.on = false
  facts.count = 0
})

describe('PriceRangeBlock', () => {
  it('draws one bar per bin, and paints the bars the band holds', () => {
    facts.range = [20000, 24000]
    facts.on = true
    draw()
    expect(host.querySelectorAll('.pr-bar')).toHaveLength(3)
    expect(host.querySelectorAll('.pr-bar-on')).toHaveLength(2)
  })

  it('reads the two ends the way the cards read a price, in the corner', () => {
    facts.range = [20000, 24000]
    facts.on = true
    draw()
    expect(host.querySelector('.min-h-7')?.textContent).toContain('¥20000 - ¥24000')
  })

  it('counts what the range leaves, under the slider', () => {
    facts.range = [20000, 24000]
    facts.on = true
    facts.count = 11
    draw()
    const under = host.querySelector('.pr-count')
    expect(under?.textContent).toBe('11 只')
    expect(under?.className).toContain('text-center')
  })

  it('writes the narrowed range when a thumb moves', () => {
    draw()
    drag(0, 1)
    expect(calls).toEqual(['price:22000-26000'])
  })

  it('writes no range once the ends cover the whole list again', () => {
    facts.range = [20000, 24000]
    facts.on = true
    draw()
    drag(1, 3)
    expect(calls).toEqual(['price:null'])
  })

  it('keeps one step between the ends when they are dragged together', () => {
    facts.range = [24000, 26000]
    facts.on = true
    draw()
    drag(0, 3)
    expect(calls).toEqual(['price:24000-26000'])
  })

  it('gives up the whole block when no listing has a price', () => {
    draw(false)
    expect(host.textContent).not.toContain('价格区间')
    expect(host.querySelectorAll('input[type="range"]')).toHaveLength(0)
  })

  // A pair from another tab, over a grid with one bar added past the top.
  it('shows a band that reaches past the tab over its empty bar', () => {
    facts.range = [57000, 68000]
    facts.on = true
    draw(true, true)
    expect(host.textContent).toContain('¥26000 - ¥28000')
    expect(host.querySelectorAll('.pr-bar-on')).toHaveLength(1)
  })

  it('takes its grid shape from the facet as it starts', () => {
    draw()
    expect(mounts.n).toBe(1)
  })
})
