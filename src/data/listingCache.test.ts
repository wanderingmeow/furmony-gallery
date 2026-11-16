// Functional tests for the listings cache (listingCache.ts). No network, no rendering.
// fake-indexeddb provides a real-ish IndexedDB; localStorage comes from the testSetup shim.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdoptListing } from '../model/types'

type CacheModule = typeof import('./listingCache')

function makeListing(overrides: Partial<AdoptListing> = {}): AdoptListing {
  return { adoptId: 1, paintersId: 1, productId: 1, ...overrides }
}

// fresh module per test → module-level state is isolated; DB is a shared fake-indexeddb
// global, so reset the table between tests
let mod: CacheModule
beforeEach(async () => {
  vi.resetModules()
  mod = await import('./listingCache')
  await mod.clearListings()
})

describe('listings cache (adoptId-keyed table + order record)', () => {
  it('saveListings → loadListings round-trips and preserves display order', async () => {
    const rows = [
      makeListing({ adoptId: 3, adoptName: 'c' }),
      makeListing({ adoptId: 1, adoptName: 'a' }),
      makeListing({ adoptId: 2, adoptName: 'b' }),
    ]
    await mod.saveListings(rows)
    const loaded = await mod.loadListings()
    expect(loaded!.map((l) => l.adoptId)).toEqual([3, 1, 2]) // order preserved, not adoptId-sorted
    expect(loaded![0].adoptName).toBe('c')
  })

  it('returns null when empty', async () => {
    expect(await mod.loadListings()).toBeNull()
  })

  it('clearListings empties the table', async () => {
    await mod.saveListings([makeListing({ adoptId: 1 })])
    await mod.clearListings()
    expect(await mod.loadListings()).toBeNull()
  })
})

describe('mergeListings (what the reader would see)', () => {
  // The API signs every cover on every request, so a second fetch carries a new query string
  // on every URL and the same pictures.
  const signed = (id: number, sig: string): AdoptListing => ({
    adoptId: id, paintersId: 1, productId: 1,
    adoptPicture: `https://cdn.example/${id}.jpg?q-signature=${sig}`,
    harmonyAdoptDetails: [{ detailPicture: `https://cdn.example/${id}-1.jpg?q-signature=${sig}` }],
  })

  it('a new signature is the same row, and keeps its object', async () => {
    const before = signed(1, 'aaa')
    const after = signed(1, 'bbb')
    const r = await mod.mergeListings([before], [after])
    expect(r.changed).toBe(false)
    expect(r.updated[0]).toBe(before)
  })

  it('unchanged rows keep their objects, a changed row takes the new one', async () => {
    const a = makeListing({ adoptId: 1, allcost: 10 })
    const b = makeListing({ adoptId: 2, allcost: 100 })
    // a fresh parse of the same row: equal content, different object
    const aAgain = { ...makeListing({ adoptId: 1, allcost: 10 }) }
    const bCheaper = makeListing({ adoptId: 2, allcost: 80 })
    const r = await mod.mergeListings([a, b], [aAgain, bCheaper])
    expect(r.changed).toBe(true)
    expect(r.updated[0]).toBe(a) // the card for row 1 keeps its DOM node
    expect(r.updated[1]).toBe(bCheaper)
  })

  it('a shuffle is a change, and every row keeps its object', async () => {
    const a = makeListing({ adoptId: 1 })
    const b = makeListing({ adoptId: 2 })
    const r = await mod.mergeListings([a, b], [{ ...b }, { ...a }])
    expect(r.changed).toBe(true)
    expect(r.updated[0]).toBe(b)
    expect(r.updated[1]).toBe(a)
  })

  it('a removed row is a change', async () => {
    const a = makeListing({ adoptId: 1 })
    const b = makeListing({ adoptId: 2 })
    const r = await mod.mergeListings([a, b], [{ ...a }])
    expect(r.changed).toBe(true)
    expect(r.updated.map((l) => l.adoptId)).toEqual([1])
  })

  it('a reshuffled color list is the same row once the API order is settled', async () => {
    // The API gives the color list no fixed order. api.ts sorts it on the way in; without that
    // sort these rows would look changed on every visit.
    const { sortColorsAndPictures } = await import('./api')
    const row = (colors: number[]) => sortColorsAndPictures({
      adoptId: 1, paintersId: 1, productId: 1,
      harmonyAdoptColorVos: colors.map((colorId) => ({ colorId })),
    })
    const r = await mod.mergeListings([row([4, 1])], [row([1, 4])])
    expect(r.changed).toBe(false)
  })

  it('the field order in the answer is not a change', async () => {
    const a = { adoptId: 1, adoptName: 'A', paintersId: 1, productId: 1 } as AdoptListing
    const b = { paintersId: 1, productId: 1, adoptId: 1, adoptName: 'A' } as AdoptListing
    expect((await mod.mergeListings([a], [b])).changed).toBe(false)
  })

  it('a name with a question mark is not cut at it', async () => {
    const a = makeListing({ adoptId: 1, adoptName: '这是什么?' })
    const b = makeListing({ adoptId: 1, adoptName: '这是什么' })
    expect((await mod.mergeListings([a], [b])).changed).toBe(true)
  })

  it('changed when row count differs', async () => {
    const r = await mod.mergeListings([], [makeListing({ adoptId: 1 })])
    expect(r.changed).toBe(true)
  })

  it('unchanged for identical rows → does not rewrite the table', async () => {
    const rows = [makeListing({ adoptId: 1, adoptName: 'A' })]
    await mod.saveListings(rows)
    const r = await mod.mergeListings(rows, [{ ...rows[0] }])
    expect(r.changed).toBe(false)
    // table still intact (no rewrite happened)
    const loaded = await mod.loadListings()
    expect(loaded!.map((l) => l.adoptId)).toEqual([1])
  })

  it('a real change rewrites the table with the merged rows', async () => {
    const a = signed(1, 'aaa')
    await mod.saveListings([a])
    const b = makeListing({ adoptId: 2, adoptName: 'B' })
    const r = await mod.mergeListings([a], [a, b])
    expect(r.changed).toBe(true)
    const loaded = await mod.loadListings()
    expect(loaded!.map((l) => l.adoptId)).toEqual([1, 2])
  })
})
