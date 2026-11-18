// The filter circle: the number at its corner, the funnel it wears, and when it turns orange.
// What those signals mean is the stores' business, tested there; the mocks here just answer.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'solid-js/web'
import { FloatingActions } from './FloatingActions'

const facts = vi.hoisted(() => ({ count: 0 }))

vi.mock('@solidjs/router', () => ({ useNavigate: () => () => {} }))

// The circle's own four inputs. What the panel holds is FilterPanel's own test's business, so the
// panel is a stub here; one test still opens it, to check that the fill follows.
vi.mock('./FilterPanel', () => ({ FilterPanel: () => <div>panel</div> }))
vi.mock('../../stores/derivedStore', () => ({
  filtersOnCount: () => facts.count,
}))
vi.mock('../../stores/filterStore', () => ({ sortMode: () => 'timeDesc' }))
vi.mock('../../stores/listingsStore', () => ({
  fetchFailed: () => false,
  loadData: () => Promise.resolve(),
}))
vi.mock('../../stores/semanticStore', () => ({ semanticActive: () => false }))

let dispose: (() => void) | undefined
let host: HTMLDivElement

const circle = () => {
  const button = host.querySelector<HTMLButtonElement>('button[aria-label^="排序"]')
  if (!button) throw new Error('no filter circle')
  return button
}

/** The number at the corner, or null when there is nothing to count. Read off the whole button:
 *  the glyph and the sort mark draw no text, so the only text there is the number. */
const badge = () => {
  const text = circle().textContent?.trim() ?? ''
  return text === '' ? null : text
}

function draw() {
  // Rendering twice replaces what is on screen, so a test can change the facts and look again.
  // The facts are plain objects, so nothing else would tell the page that they moved.
  dispose?.()
  host?.remove()
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(() => <FloatingActions scrollTop={() => 0} onTop={() => {}} />, host)
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
