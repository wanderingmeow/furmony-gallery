import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSignal, type JSX } from 'solid-js'
import { render } from 'solid-js/web'
import type { AdoptListing } from '../../model/types'
import { ListingCard } from './ListingCard'

const { listing } = vi.hoisted(() => ({
  listing: {
    adoptId: 42,
    adoptName: '天冬',
    paintersId: 7,
    productId: 9,
    totalPrice: 27800,
    adoptPicture: 'https://bucket.cos.ap-guangzhou.myqcloud.com/cover-42.png',
  } as AdoptListing,
}))

vi.mock('../../store', () => ({
  isWishlisted: () => false,
  priceMode: () => 'once',
  toggleWishlist: () => {},
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
