// Functional tests for the pure scroll-restore row finder (scrollRestore.ts). No reactivity, no I/O.
import { describe, expect, it } from 'vitest'
import { findIndex } from './scrollRestore'
import type { AdoptListing } from './types'

function listing(id: number, overrides: Partial<AdoptListing> = {}): AdoptListing {
  return { adoptId: id, paintersId: 1, productId: 1, ...overrides }
}

describe('findIndex', () => {
  it('returns the exact adoptId index when present', () => {
    const rows = [listing(1), listing(2), listing(3)]
    expect(findIndex(rows, 2)).toBe(1)
  })

  it('returns 0 when the id is absent (e.g. filtered out of the view)', () => {
    const rows = [listing(1), listing(2), listing(3)]
    expect(findIndex(rows, 99)).toBe(0)
  })

  it('returns 0 for an empty list', () => {
    expect(findIndex([], 42)).toBe(0)
  })
})
