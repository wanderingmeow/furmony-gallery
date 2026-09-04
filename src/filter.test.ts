// Functional tests for the pure filtering/sorting layer (filter.ts). No reactivity, no I/O.
import { describe, expect, it } from 'vitest'
import { compute } from './filter'
import type { SocialSearchEntry } from './socials'
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
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP }))).toEqual([2])
  })
})

describe('compute — tab', () => {
  const rows = [
    listing(1, { isLock: 2 }), // locked
    listing(2, { isLock: 1 }), // isLock=1 → pure unlocked in processing
    listing(3, { isLock: 0 }), // unlocked
  ]

  it('unlocked tab includes isLock=1 but excludes isLock=2', () => {
    expect(ids(compute({ rows, tab: 'unlocked', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP }))).toEqual([2, 3])
  })

  it('locked tab only includes isLock=2', () => {
    expect(ids(compute({ rows, tab: 'locked', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP }))).toEqual([1])
  })

  it('all tab includes every non-self listing', () => {
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP }))).toEqual([1, 2, 3])
  })

  it('wishlist tab keeps only wishlisted, sorted by add-time desc', () => {
    const wl = new Map([[1, 10], [3, 30]])
    expect(ids(compute({ rows, tab: 'wishlist', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: '', wishlist: wl }))).toEqual([3, 1])
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
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: new Set(['红']), races: EMPTY, query: '', wishlist: EMPTY_MAP }))).toEqual([1])
  })

  it('race filter matches harmonyRace.raceName', () => {
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: new Set(['龙']), query: '', wishlist: EMPTY_MAP }))).toEqual([4])
  })

  it('empty color/race sets keep everything', () => {
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP }))).toEqual([1, 2, 3, 4])
  })
})

describe('compute — sort modes', () => {
  it('priceAsc sorts by nonrecurringExpense ascending', () => {
    const rows = [
      listing(1, { nonrecurringExpense: 100 }),
      listing(2, { nonrecurringExpense: 10 }),
      listing(3, { nonrecurringExpense: 50 }),
    ]
    expect(ids(compute({ rows, tab: 'all', sort: 'priceAsc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP }))).toEqual([2, 3, 1])
  })

  it('priceDesc sorts descending', () => {
    const rows = [
      listing(1, { nonrecurringExpense: 100 }),
      listing(2, { nonrecurringExpense: 10 }),
    ]
    expect(ids(compute({ rows, tab: 'all', sort: 'priceDesc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP }))).toEqual([1, 2])
  })

  it('timeDesc sorts by createTime desc', () => {
    const rows = [
      listing(1, { createTime: '2024-01-01 10:00:00' }),
      listing(2, { createTime: '2024-03-01 10:00:00' }),
      listing(3, { createTime: '2024-02-01 10:00:00' }),
    ]
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP }))).toEqual([2, 3, 1])
  })

  it('timeAsc sorts ascending', () => {
    const rows = [
      listing(1, { createTime: '2024-01-01 10:00:00' }),
      listing(2, { createTime: '2024-03-01 10:00:00' }),
    ]
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP }))).toEqual([1, 2])
  })
})

describe('compute — search', () => {
  it('matches adoptName or detailDescription, case-insensitive', () => {
    const rows = [
      listing(1, { adoptName: 'Furry Fox' }),
      listing(2, { detailDescription: '一只帅气的狼' }),
      listing(3, { adoptName: '别的东西' }),
    ]
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: 'furry', wishlist: EMPTY_MAP }))).toEqual([1])
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: '狼', wishlist: EMPTY_MAP }))).toEqual([2])
  })

  it('empty query keeps everything', () => {
    const rows = [listing(1), listing(2)]
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP }))).toEqual([1, 2])
  })

  it('digits-only query PREFIX-matches adoptId (e.g. 259 finds 259/2594 but not 12594)', () => {
    const rows = [listing(2594), listing(259), listing(12594), listing(42)]
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: '259', wishlist: EMPTY_MAP }))).toEqual([2594, 259])
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: '42', wishlist: EMPTY_MAP }))).toEqual([42])
  })

  it('digits query unions id match with name/description (e.g. 3 finds "L3D" in description)', () => {
    const rows = [
      listing(1, { adoptName: '狼' }),
      listing(2, { detailDescription: 'L3D 渲染' }),
      listing(3, { adoptName: '某设定' }),
      listing(30, { adoptName: '别的' }),
    ]
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: '3', wishlist: EMPTY_MAP }))).toEqual([2, 3, 30])
  })

  it('digits query trims whitespace', () => {
    const rows = [listing(2594), listing(42)]
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: '  2594  ', wishlist: EMPTY_MAP }))).toEqual([2594])
  })

  it('non-digits query falls back to name/description search', () => {
    const rows = [listing(2594, { adoptName: 'Furry Fox' }), listing(42, { adoptName: '狼' })]
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: 'Fox', wishlist: EMPTY_MAP }))).toEqual([2594])
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: '狼', wishlist: EMPTY_MAP }))).toEqual([42])
  })

  it('digits query with no match returns empty', () => {
    const rows = [listing(2594)]
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: '999', wishlist: EMPTY_MAP }))).toEqual([])
  })
})

describe('compute — socials search', () => {
  // fake data — tests must never reference real owner names/handles from production
  const SOCIALS = new Map<number, SocialSearchEntry>([
    [1, { ownerName: 'TestOwnerOne', searchables: ['TestHandleOne'], uidPrefixes: [] }],
    [2, { ownerName: 'TestOwnerTwo', searchables: [], uidPrefixes: ['12345678'] }],
  ])
  const rows = [listing(1), listing(2)]

  it('text query matches ownerName', () => {
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: 'TestOwnerOne', wishlist: EMPTY_MAP, socials: SOCIALS }))).toEqual([1])
  })

  it('text query matches an x handle', () => {
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: 'TestHandleOne', wishlist: EMPTY_MAP, socials: SOCIALS }))).toEqual([1])
  })

  it('digit query PREFIX-matches a douyin uid', () => {
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: '123', wishlist: EMPTY_MAP, socials: SOCIALS }))).toEqual([2])
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: '12345678', wishlist: EMPTY_MAP, socials: SOCIALS }))).toEqual([2])
  })

  it('digit query does NOT substring-match a uid (prefix only)', () => {
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: '3456', wishlist: EMPTY_MAP, socials: SOCIALS }))).toEqual([])
  })

  it('absent socials map leaves behavior unchanged', () => {
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: 'TestOwnerOne', wishlist: EMPTY_MAP }))).toEqual([])
  })
})
