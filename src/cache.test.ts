// Functional tests for the IndexedDB cache layer (cache.ts). No network, no rendering.
// fake-indexeddb provides a real-ish IndexedDB; localStorage comes from jsdom.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdoptListing } from './types'

type CacheModule = typeof import('./cache')

function makeListing(overrides: Partial<AdoptListing> = {}): AdoptListing {
  return { adoptId: 1, paintersId: 1, productId: 1, ...overrides }
}

// fresh module per test → module-level imageUrlMap/dirtyPaths state is isolated
let mod: CacheModule
beforeEach(async () => {
  vi.resetModules()
  mod = await import('./cache')
  await mod.clearListings() // DB is a shared fake-indexeddb global — reset the table
})

describe('stableImageUrl (img_url_map)', () => {
  it('maps a signed URL (with ?) and remembers the first-seen URL', () => {
    const first = mod.stableImageUrl('https://a.jpg?sig=1')
    // same path with a different signature returns the remembered one
    expect(mod.stableImageUrl('https://a.jpg?sig=999')).toBe('https://a.jpg?sig=1')
    expect(first).toBe('https://a.jpg?sig=1')
  })

  it('bypasses no-query URLs entirely (nothing stored, raw returned)', () => {
    expect(mod.stableImageUrl('https://plain.jpg')).toBe('https://plain.jpg')
  })

  it('passes undefined through', () => {
    expect(mod.stableImageUrl(undefined)).toBeUndefined()
  })

  it('persists dirty entries to IndexedDB and reloads them on a fresh module', async () => {
    mod.stableImageUrl('https://a.jpg?x=1')
    await mod.flushImageUrlMap()
    // seed a stale legacy localStorage copy that init should remove
    localStorage.setItem('furmony_image_url_map', '{"https://a.jpg":"https://a.jpg?legacy=1"}')

    vi.resetModules()
    mod = await import('./cache')
    await mod.initImageUrlMap()

    // remembered URL from DB wins over the fresh signature
    expect(mod.stableImageUrl('https://a.jpg?y=2')).toBe('https://a.jpg?x=1')
    expect(localStorage.getItem('furmony_image_url_map')).toBeNull()
  })
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

describe('mergeListings (content-compare, no hash)', () => {
  it('changed when row count differs', async () => {
    const r = await mod.mergeListings([], [makeListing({ adoptId: 1 })])
    expect(r.changed).toBe(true)
  })

  it('changed when a row content differs', async () => {
    const a = makeListing({ adoptId: 1, adoptName: 'A' })
    const b = makeListing({ adoptId: 1, adoptName: 'B' })
    const r = await mod.mergeListings([a], [b])
    expect(r.changed).toBe(true)
  })

  it('unchanged for identical rows → does not rewrite the table', async () => {
    const rows = [makeListing({ adoptId: 1, adoptName: 'A' })]
    await mod.saveListings(rows)
    const r = await mod.mergeListings(rows, rows)
    expect(r.changed).toBe(false)
    // table still intact (no rewrite happened)
    const loaded = await mod.loadListings()
    expect(loaded!.map((l) => l.adoptId)).toEqual([1])
  })
})
