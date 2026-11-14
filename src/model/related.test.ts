// Functional tests for the pure related domain (related.ts). No reactivity, no I/O.
// All ids below are FAKE.
import { describe, expect, it } from 'vitest'
import type { AdoptListing } from './types'
import { EMPTY_TABLE, MIN_RELATED, parseRelated, relatedIds, resolveRelated } from './related'

function fake(adoptId: number, paintersId = 11): AdoptListing {
  return { adoptId, paintersId, productId: 0 }
}

describe('parseRelated', () => {
  it('reads the neighbour table', () => {
    const table = parseRelated({ topN: 2, neighbors: { '10': [11, 12], '11': [10, 12] } })
    expect(table.topN).toBe(2)
    expect(relatedIds(table, 10)).toEqual([11, 12])
    expect(relatedIds(table, 11)).toEqual([10, 12])
  })

  it('drops a neighbour that points at the query itself', () => {
    const table = parseRelated({ topN: 3, neighbors: { '10': [10, 11] } })
    expect(relatedIds(table, 10)).toEqual([11])
  })

  it('degrades to no data instead of throwing', () => {
    for (const bad of [null, undefined, 42, 'x', {}, { neighbors: 'no' }, { topN: 'x', neighbors: {} }]) {
      expect(parseRelated(bad).neighbors.size).toBe(0)
    }
  })

  it('skips malformed keys and non-array values', () => {
    const table = parseRelated({ topN: 2, neighbors: { 'abc': [1], '10': 'nope', '11': [12, 'x', null] } })
    expect(relatedIds(table, 999)).toEqual([])
    expect(relatedIds(table, 11)).toEqual([12])
  })

  it('returns nothing for an id the table does not know', () => {
    expect(relatedIds(EMPTY_TABLE, 10)).toEqual([])
    expect(relatedIds(parseRelated({ topN: 1, neighbors: { '10': [11] } }), 77)).toEqual([])
  })
})

describe('resolveRelated', () => {
  const listings = [fake(10), fake(11), fake(12, 3)]

  it('keeps the generator order — the ranking is the whole point', () => {
    expect(resolveRelated([12, 10, 11], listings).map((l) => l.adoptId)).toEqual([12, 10, 11])
  })

  it('drops neighbours that are no longer in the listing set', () => {
    expect(resolveRelated([12, 99, 10], listings).map((l) => l.adoptId)).toEqual([12, 10])
  })

  // The self-entry guard lives in the parser, so the card you are on cannot come back
  // as a neighbour. Tested through the real path rather than a parameter.
  it('never recommends the card you are already on', () => {
    const table = parseRelated({ topN: 2, neighbors: { '10': [10, 11] } })
    expect(resolveRelated(relatedIds(table, 10), listings).map((l) => l.adoptId)).toEqual([11])
  })

  it('handles empty input', () => {
    expect(resolveRelated([], listings)).toEqual([])
    expect(resolveRelated([1, 2], [])).toEqual([])
  })

  it('hides the strip below the threshold but shows it at it', () => {
    expect(resolveRelated([10, 11, 12], listings).length).toBeGreaterThanOrEqual(MIN_RELATED)
    expect(resolveRelated([10, 99, 98], listings).length).toBeLessThan(MIN_RELATED)
  })
})
