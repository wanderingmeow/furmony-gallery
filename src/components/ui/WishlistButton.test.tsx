// These tests cover the button: the flip it makes, the burst that follows a save and not an unsave,
// the label that buzzes under the tap, and the click the card asks it to keep.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JSX } from 'solid-js'
import { render } from 'solid-js/web'
import type { AdoptListing } from '../../model/types'
import { isWishlisted, setWishlist } from '../../stores/wishlistStore'
import { withSwitch } from '../../testSetup'
import { WishlistButton } from './WishlistButton'

const item = { adoptId: 42, adoptName: '天冬', paintersId: 7, productId: 9 } as AdoptListing

let dispose: (() => void) | undefined
let host: HTMLDivElement

function mount(view: () => JSX.Element): void {
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(view, host)
}

const button = () => host.querySelector('button')!
const sparks = () => host.querySelectorAll('.heart-spark')

beforeEach(() => {
  setWishlist(new Map())
  localStorage.clear()
  withSwitch(false)
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => cb(0))
})

afterEach(() => {
  dispose?.()
  host?.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('WishlistButton', () => {
  it('saves and plays on a click, and the heart fills', () => {
    mount(() => <WishlistButton item={item} />)
    button().click()
    expect(isWishlisted(item.adoptId), 'the click reaches the wishlist').toBe(true)
    expect(host.querySelector('svg')).toBeTruthy()
    expect(sparks()).toHaveLength(6)
  })

  // A scroll that began on the heart ends with a click on it, and the engine hands that click over
  // even though the reader meant the page to move.
  it('ignores a click whose press travelled', () => {
    mount(() => <WishlistButton item={item} />)
    const btn = button()
    btn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 40, clientY: 30 }))
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 12, clientY: 90 }))
    expect(isWishlisted(item.adoptId), 'the press moved 60px: that was a scroll').toBe(false)
  })

  it('flips for a press that stayed where it landed', () => {
    mount(() => <WishlistButton item={item} />)
    const btn = button()
    btn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 40, clientY: 30 }))
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 42, clientY: 33 }))
    expect(isWishlisted(item.adoptId)).toBe(true)
  })

  // The tap lands on the buzz label, and the click a label forwards to its control carries no
  // coordinates. That click is the tap.
  it('flips for the click the buzz switch forwards, which carries no coordinates', () => {
    withSwitch(true)
    mount(() => <WishlistButton item={item} />)
    const btn = button()
    btn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 40, clientY: 30 }))
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(isWishlisted(item.adoptId), 'a coordinate-free click is the switch, not a scroll').toBe(true)
  })

  it('keeps a refused press away from the card around it', () => {
    let outer = 0
    mount(() => (
      <div onClick={() => (outer += 1)}>
        <WishlistButton item={item} stop />
      </div>
    ))
    const btn = button()
    btn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 40, clientY: 30 }))
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 12, clientY: 90 }))
    expect(outer, 'a press this button refused still stops here').toBe(0)
  })

  it('plays nothing on a click that empties the wishlist', () => {
    setWishlist(new Map([[item.adoptId, 1]]))
    mount(() => <WishlistButton item={item} />)
    button().click()
    expect(isWishlisted(item.adoptId)).toBe(false)
    expect(sparks()).toHaveLength(0)
  })

  // The card behind the sheet shows the same listing, and a save there is not a save made here.
  it('plays nothing for a save that happened elsewhere', () => {
    mount(() => <WishlistButton item={item} />)
    setWishlist(new Map([[item.adoptId, 1]]))
    expect(sparks()).toHaveLength(0)
  })

  it('names the icon-only copy and leaves a chip with a label to its own text', () => {
    mount(() => (
      <div>
        <WishlistButton item={item} />
        <WishlistButton item={{ ...item, adoptId: 43 }}>
          <span>saved</span>
        </WishlistButton>
      </div>
    ))
    const [icon, chip] = [...host.querySelectorAll('button')]
    expect(icon.getAttribute('aria-label'), 'an icon has to say what it is').toBeTruthy()
    expect(chip.getAttribute('aria-label'), 'the label already says it').toBeNull()
  })

  it('carries a switch, and a tap on the label saves once', () => {
    withSwitch(true)
    mount(() => <WishlistButton item={item} />)
    const buzz = host.querySelector<HTMLInputElement>('.haptic-switch')
    expect(buzz, 'a tap on the button should buzz').toBeTruthy()
    host.querySelector<HTMLElement>('.haptic-hit')!.click()
    expect(isWishlisted(item.adoptId), 'the label is the tap target').toBe(true)
    expect(sparks(), 'one tap, one save').toHaveLength(6)
    expect(buzz!.checked, 'and the switch turned').toBe(true)
  })

  it('keeps the click away from the card around it', () => {
    let outer = 0
    mount(() => (
      <div onClick={() => (outer += 1)}>
        <WishlistButton item={item} stop />
      </div>
    ))
    button().click()
    expect(outer, 'the card opens on the same click').toBe(0)
    expect(isWishlisted(item.adoptId)).toBe(true)
  })
})
