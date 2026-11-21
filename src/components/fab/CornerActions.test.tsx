import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'solid-js/web'
import { CornerActions } from './CornerActions'

const facts = vi.hoisted(() => ({ count: 0 }))

vi.mock('@solidjs/router', () => ({ useNavigate: () => () => {} }))

vi.mock('./FilterPanel', () => ({ FilterPanel: () => <div>panel</div> }))
vi.mock('../../stores/derivedStore', () => ({
  filtersOnCount: () => facts.count,
}))
vi.mock('../../stores/filterStore', () => ({ sortMode: () => 'timeDesc' }))
vi.mock('../../stores/listingsStore', () => ({
  fetchFailed: () => false,
  loadData: () => Promise.resolve(),
}))
const staged = vi.hoisted(() => ({ picture: false }))
vi.mock('../../stores/semanticStore', () => ({
  semanticActive: () => false,
  picture: { on: () => staged.picture },
}))

let dispose: (() => void) | undefined
let host: HTMLDivElement

const circle = () => {
  const button = host.querySelector<HTMLButtonElement>('button[aria-label^="排序"]')
  if (!button) throw new Error('no funnel')
  return button
}

/** The number at the corner, or null when there is nothing to count. Read off the whole button:
 *  the glyph and the sort mark draw no text, so the only text there is the number. */
const badge = () => {
  const text = circle().textContent?.trim() ?? ''
  return text === '' ? null : text
}

function draw() {
  // the facts are plain objects, so a redraw has to replace what is on screen
  dispose?.()
  host?.remove()
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(() => <CornerActions />, host)
}

beforeEach(() => {
  facts.count = 0
})

afterEach(() => {
  dispose?.()
  host?.remove()
})

describe('the filter circle', () => {
  it('shows the number the store counts', () => {
    facts.count = 3
    draw()
    expect(badge()).toBe('3')
  })

  it('shows no number when nothing is on', () => {
    draw()
    expect(badge()).toBeNull()
  })

  it('is plain until the panel opens', () => {
    facts.count = 2
    draw()
    expect(circle().className).not.toContain('bg-accent')
    circle().click()
    expect(circle().className).toContain('bg-accent')
    expect(badge()).toBe('2')
  })
})

describe('the charts beside it', () => {
  const charts = () => {
    const button = host.querySelector<HTMLButtonElement>('button[aria-label^="数据统计"]')
    if (!button) throw new Error('no charts')
    return button
  }

  it('stands beside the funnel', () => {
    draw()
    expect(charts()).toBeTruthy()
  })

  it('stands in the slot the band gives its exit to', () => {
    draw()
    expect((charts().parentElement as HTMLElement).dataset.chrome).toBe('stats')
  })
})
