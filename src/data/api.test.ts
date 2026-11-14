// Tests that both endpoints really end up in the result. In tests api.ts reads the saved
// copies in agent/*.json instead of calling the site, so this needs no network — and those
// copies are gitignored, hence the skip.
import { describe, expect, it } from 'vitest'

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
