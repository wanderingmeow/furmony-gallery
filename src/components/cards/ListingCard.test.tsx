import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSignal, type JSX } from 'solid-js'
import { render } from 'solid-js/web'
import type { AdoptListing } from '../../model/types'
import { withSwitch } from '../../testSetup'
import { ListingCard } from './ListingCard'

const { listing, taps } = vi.hoisted(() => ({
  listing: {
    adoptId: 42,
    adoptName: '天冬',
    paintersId: 7,
    productId: 9,
    totalPrice: 27800,
    adoptPicture: 'https://bucket.cos.ap-guangzhou.myqcloud.com/cover-42.png',
  } as AdoptListing,
  taps: { count: 0 },
}))

vi.mock('../../stores/wishlistStore', () => ({
  isWishlisted: () => false,
  toggleWishlist: () => { taps.count += 1 },
}))
vi.mock('../../stores/displayStore', () => ({
  priceMode: () => 'once',
}))

let dispose: (() => void) | undefined
let host: HTMLDivElement

function mount(card: () => JSX.Element): void {
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(card, host)
}

function picture(): HTMLImageElement {
  return host.querySelector('img')!
}

/** The card hands over its address one frame later, so the test waits for that frame. */
function frame(): Promise<void> {
  return new Promise((done) => {
    requestAnimationFrame(() => done())
    setTimeout(done, 60)
  })
}

afterEach(() => {
  dispose?.()
  host?.remove()
  dispose = undefined
  taps.count = 0
  withSwitch(false)
})

describe('ListingCard picture', () => {
  it('holds the address while the page moves fast', async () => {
    const [hold] = createSignal(true)
    mount(() => <ListingCard listing={listing} width={240} hold={hold} />)
    await frame()
    expect(picture().getAttribute('src')).toBe(null)
  })

  it('takes the address once the motion settles', async () => {
    const [hold, setHold] = createSignal(true)
    mount(() => <ListingCard listing={listing} width={240} hold={hold} />)
    await frame()
    setHold(false)
    await frame()
    expect(picture().getAttribute('src')).toContain('cover-42.png')
  })

  it('takes the address at once when nothing is held', async () => {
    mount(() => <ListingCard listing={listing} width={240} />)
    await frame()
    expect(picture().getAttribute('src')).toContain('cover-42.png')
  })
})

describe('ListingCard heart', () => {
  const heart = () => host.querySelector('.tap-heart')!.closest('button')!

  it('the heart carries a switch, and a tap on it reaches the button', () => {
    withSwitch(true)
    mount(() => <ListingCard listing={listing} width={240} />)
    const buzz = heart().querySelector<HTMLInputElement>('.haptic-switch')
    expect(buzz, 'a tap on the heart should buzz').toBeTruthy()
    buzz!.click()
    expect(taps.count, 'the switch lies under the tap, not in front of it').toBe(1)
  })

  it('the heart carries no switch where the engine has none', () => {
    withSwitch(false)
    mount(() => <ListingCard listing={listing} width={240} />)
    expect(host.querySelector('.haptic-switch')).toBeNull()
  })
})
