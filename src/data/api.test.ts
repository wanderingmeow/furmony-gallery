// Tests that both endpoints really end up in the result. In tests api.ts reads the saved
// copies in agent/*.json instead of calling the site, so this needs no network — and those
// copies are gitignored, hence the skip.
import { describe, expect, it } from 'vitest'
import type { AdoptListing } from '../model/types'

const fixtures = import.meta.glob('../../agent/*_sample.json')
const haveFixtures = Object.keys(fixtures).length >= 2

describe.skipIf(!haveFixtures)('fetchAllListings combines both endpoints', () => {
  it('appends the 新作登场 rows onto the main list with no duplicate ids', async () => {
    const { fetchAllListings } = await import('./api')
    const rows = await fetchAllListings()

    const ids = rows.map((l) => l.adoptId)
    expect(new Set(ids).size).toBe(ids.length) // every id appears exactly once

    // these three only exist on the 新作登场 endpoint — drop that request or the merge and
    // they silently vanish from the whole app
    for (const debutId of [2831, 2832, 2833]) expect(ids).toContain(debutId)
  })
})

// The API gives these two lists no fixed order, so one listing can come back with its colors
// and its pictures swapped between two requests.
describe('sortColorsAndPictures', () => {
  const row = (over: Partial<AdoptListing>): AdoptListing => ({
    adoptId: 1, paintersId: 1, productId: 1, ...over,
  })

  it('puts colors in colorId order', async () => {
    const { sortColorsAndPictures } = await import('./api')
    const settled = sortColorsAndPictures(row({ harmonyAdoptColorVos: [{ colorId: 4 }, { colorId: 1 }] }))
    expect(settled.harmonyAdoptColorVos!.map((c) => c.colorId)).toEqual([1, 4])
  })

  it('puts pictures in path order, ignoring the signature', async () => {
    const { sortColorsAndPictures } = await import('./api')
    const settled = sortColorsAndPictures(row({
      harmonyAdoptDetails: [
        { detailPicture: 'https://cdn/b.png?q-signature=zzz' },
        { detailPicture: 'https://cdn/a.jpg?q-signature=aaa' },
      ],
    }))
    expect(settled.harmonyAdoptDetails!.map((d) => d.detailPicture)).toEqual([
      'https://cdn/a.jpg?q-signature=aaa',
      'https://cdn/b.png?q-signature=zzz',
    ])
  })

  it('leaves a row without those lists alone', async () => {
    const { sortColorsAndPictures } = await import('./api')
    expect(sortColorsAndPictures(row({})).harmonyAdoptColorVos).toBeUndefined()
  })
})
