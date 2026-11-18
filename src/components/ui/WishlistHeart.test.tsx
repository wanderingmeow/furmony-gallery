// These tests cover when the burst plays: on the way into the wishlist, and not on the way out,
// not on a mount that is already saved, and not in a copy that nobody pressed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'solid-js/web'
import { createSignal, type JSX } from 'solid-js'
import { WishlistHeart } from './WishlistHeart'

let disposeApp: () => void
let host: HTMLDivElement

function mount(view: () => JSX.Element): void {
  host = document.createElement('div')
  document.body.appendChild(host)
  disposeApp = render(view, host)
}

const sparks = () => host.querySelectorAll('.heart-spark')

// The copy whose button was pressed is the one that plays, so a test that expects a burst presses
// first.
const press = () => {
  host.querySelector('span')?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => cb(0))
})

afterEach(() => {
  disposeApp()
  host.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('WishlistHeart', () => {
  it('shows a filled heart and no burst for a listing already saved', () => {
    mount(() => <WishlistHeart on />)
    expect(sparks()).toHaveLength(0)
    expect(host.querySelector('.heart-pop')).toBeNull()
  })

  it('plays when the listing enters the wishlist, then leaves the tree', () => {
    const [saved, setSaved] = createSignal(false)
    mount(() => <WishlistHeart on={saved()} />)
    press()
    setSaved(true)
    expect(sparks()).toHaveLength(6)
    expect(host.querySelector('.heart-pop')).not.toBeNull()
    vi.advanceTimersByTime(620)
    expect(sparks()).toHaveLength(0)
    expect(host.querySelector('.heart-pop')).toBeNull()
  })

  it('stays quiet when the listing leaves the wishlist', () => {
    const [saved, setSaved] = createSignal(true)
    mount(() => <WishlistHeart on={saved()} />)
    press()
    setSaved(false)
    expect(sparks()).toHaveLength(0)
  })

  it('stays quiet when the listing is saved somewhere else', () => {
    const [saved, setSaved] = createSignal(false)
    mount(() => <WishlistHeart on={saved()} />)
    setSaved(true)
    expect(sparks()).toHaveLength(0)
  })

  it('sizes the burst by the heart, not by the row around it', () => {
    const [saved, setSaved] = createSignal(false)
    mount(() => <WishlistHeart on={saved()} size={18} />)
    press()
    setSaved(true)
    expect(host.querySelector('.heart-burst')?.getAttribute('style')).toContain('font-size: 18px')
  })
})
