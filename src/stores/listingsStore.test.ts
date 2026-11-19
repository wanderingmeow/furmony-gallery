// What loadData() hands the screen, with the network and the cache held by mocks.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdoptListing } from '../model/types'

const loadListings = vi.fn()
const fetchAllListings = vi.fn()
const mergeListings = vi.fn()
const notifyListingChanges = vi.fn()

vi.mock('../data/listingCache', () => ({
  loadListings: () => loadListings(),
  mergeListings: (prev: AdoptListing[], next: AdoptListing[]) => mergeListings(prev, next),
}))
vi.mock('../data/api', () => ({ fetchAllListings: () => fetchAllListings() }))
vi.mock('./wishlistStore', () => ({ cleanStaleWishlist: vi.fn() }))
vi.mock('./notificationStore', () => ({
  notifyListingChanges: (a: unknown, b: unknown) => notifyListingChanges(a, b),
}))

const { loadData, listings } = await import('./listingsStore')

const row = (adoptId: number, painterName: string): AdoptListing => ({
  adoptId,
  paintersId: 1,
  productId: 1,
  harmonyPainterVo: { painterid: 1, painterName },
})
const shelfRow = row(2, '某画师')
const selfRow = row(1, '自设委托')

beforeEach(() => {
  loadListings.mockReset().mockResolvedValue(null)
  fetchAllListings.mockReset().mockResolvedValue([shelfRow])
  mergeListings.mockReset().mockResolvedValue({ updated: [shelfRow], changed: true })
  notifyListingChanges.mockReset()
})

describe('loadData', () => {
  it('keeps a self-commission piece out of the rows the page gets', async () => {
    fetchAllListings.mockResolvedValue([selfRow, shelfRow])
    mergeListings.mockResolvedValue({ updated: [selfRow, shelfRow], changed: true })
    await loadData()
    expect(listings().map((l) => l.adoptId)).toEqual([2])
  })

  it('applies the same rule to a cache that still holds one', async () => {
    loadListings.mockResolvedValue([selfRow, shelfRow])
    await loadData()
    expect(listings().map((l) => l.adoptId)).toEqual([2])
  })

  // A notification offers a page the reader could open, so a piece they cannot reach stays out of
  // the comparison on both sides.
  it('leaves self-commission pieces out of the change comparison', async () => {
    loadListings.mockResolvedValue([shelfRow])
    fetchAllListings.mockResolvedValue([shelfRow, selfRow])
    mergeListings.mockResolvedValue({ updated: [shelfRow, selfRow], changed: true })
    await loadData()
    const call = notifyListingChanges.mock.calls.at(-1)
    expect(call?.[1].map((l: AdoptListing) => l.adoptId)).toEqual([2])
  })
})
