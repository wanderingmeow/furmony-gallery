// Functional tests for the pure filtering/sorting layer (filter.ts). No reactivity, no I/O.
import { describe, expect, it } from 'vitest'
import { compute } from './filter'
import type { AdoptListing } from './types'

function listing(id: number, overrides: Partial<AdoptListing> = {}): AdoptListing {
  return { adoptId: id, paintersId: 1, productId: 1, ...overrides }
}

const EMPTY = new Set<string>()
const EMPTY_MAP = new Map<number, number>()

function ids(result: AdoptListing[]): number[] {
  return result.map((l) => l.adoptId)
}

describe('compute — base', () => {
  it('excludes self-commission (自设委托) listings', () => {
    const rows = [
      listing(1, { harmonyPainterVo: { painterid: 1, painterName: '自设委托' } }),
      listing(2, { harmonyPainterVo: { painterid: 2, painterName: '某画师' } }),
    ]
    expect(ids(compute(rows, 'all', 'timeDesc', EMPTY, EMPTY, '', EMPTY_MAP))).toEqual([2])
  })
})

describe('compute — tab', () => {
  const rows = [
    listing(1, { isLock: 2 }), // locked
    listing(2, { isLock: 1 }), // isLock=1 → pure unlocked in processing
    listing(3, { isLock: 0 }), // unlocked
  ]

  it('unlocked tab includes isLock=1 but excludes isLock=2', () => {
    expect(ids(compute(rows, 'unlocked', 'timeDesc', EMPTY, EMPTY, '', EMPTY_MAP))).toEqual([2, 3])
  })

  it('locked tab only includes isLock=2', () => {
    expect(ids(compute(rows, 'locked', 'timeDesc', EMPTY, EMPTY, '', EMPTY_MAP))).toEqual([1])
  })

  it('all tab includes every non-self listing', () => {
    expect(ids(compute(rows, 'all', 'timeDesc', EMPTY, EMPTY, '', EMPTY_MAP))).toEqual([1, 2, 3])
  })

  it('wishlist tab keeps only wishlisted, sorted by add-time desc', () => {
    const wl = new Map([[1, 10], [3, 30]])
    expect(ids(compute(rows, 'wishlist', 'timeDesc', EMPTY, EMPTY, '', wl))).toEqual([3, 1])
  })
})

describe('compute — color & race filters', () => {
  const rows = [
    listing(1, { harmonyAdoptColorVos: [{ harmonyColor: { colorName: '红' } }] }),
    listing(2, { harmonyAdoptColorVos: [{ harmonyColor: { colorName: '蓝' } }] }),
    listing(3, { harmonyRace: { raceName: '狼' } }),
    listing(4, { harmonyRace: { raceName: '龙' } }),
  ]

  it('color filter matches any listed color', () => {
    expect(ids(compute(rows, 'all', 'timeDesc', new Set(['红']), EMPTY, '', EMPTY_MAP))).toEqual([1])
  })

  it('race filter matches harmonyRace.raceName', () => {
    expect(ids(compute(rows, 'all', 'timeDesc', EMPTY, new Set(['龙']), '', EMPTY_MAP))).toEqual([4])
  })

  it('empty color/race sets keep everything', () => {
    expect(ids(compute(rows, 'all', 'timeDesc', EMPTY, EMPTY, '', EMPTY_MAP))).toEqual([1, 2, 3, 4])
  })
})

describe('compute — sort modes', () => {
  it('priceAsc sorts by nonrecurringExpense ascending', () => {
    const rows = [
      listing(1, { nonrecurringExpense: 100 }),
      listing(2, { nonrecurringExpense: 10 }),
      listing(3, { nonrecurringExpense: 50 }),
    ]
    expect(ids(compute(rows, 'all', 'priceAsc', EMPTY, EMPTY, '', EMPTY_MAP))).toEqual([2, 3, 1])
  })

  it('priceDesc sorts descending', () => {
    const rows = [
      listing(1, { nonrecurringExpense: 100 }),
      listing(2, { nonrecurringExpense: 10 }),
    ]
    expect(ids(compute(rows, 'all', 'priceDesc', EMPTY, EMPTY, '', EMPTY_MAP))).toEqual([1, 2])
  })

  it('timeDesc sorts by createTime desc', () => {
    const rows = [
      listing(1, { createTime: '2024-01-01 10:00:00' }),
      listing(2, { createTime: '2024-03-01 10:00:00' }),
      listing(3, { createTime: '2024-02-01 10:00:00' }),
    ]
    expect(ids(compute(rows, 'all', 'timeDesc', EMPTY, EMPTY, '', EMPTY_MAP))).toEqual([2, 3, 1])
  })

  it('timeAsc sorts ascending', () => {
    const rows = [
      listing(1, { createTime: '2024-01-01 10:00:00' }),
      listing(2, { createTime: '2024-03-01 10:00:00' }),
    ]
    expect(ids(compute(rows, 'all', 'timeAsc', EMPTY, EMPTY, '', EMPTY_MAP))).toEqual([1, 2])
  })
})

describe('compute — search', () => {
  it('matches adoptName or detailDescription, case-insensitive', () => {
    const rows = [
      listing(1, { adoptName: 'Furry Fox' }),
      listing(2, { detailDescription: '一只帅气的狼' }),
      listing(3, { adoptName: '别的东西' }),
    ]
    expect(ids(compute(rows, 'all', 'timeDesc', EMPTY, EMPTY, 'furry', EMPTY_MAP))).toEqual([1])
    expect(ids(compute(rows, 'all', 'timeDesc', EMPTY, EMPTY, '狼', EMPTY_MAP))).toEqual([2])
  })

  it('empty query keeps everything', () => {
    const rows = [listing(1), listing(2)]
    expect(ids(compute(rows, 'all', 'timeDesc', EMPTY, EMPTY, '', EMPTY_MAP))).toEqual([1, 2])
  })
})
