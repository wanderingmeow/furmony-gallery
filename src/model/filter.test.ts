// Functional tests for the pure filtering/sorting layer (filter.ts). No reactivity, no I/O.
import { describe, expect, it } from 'vitest'
import { compute, hasSocial, orderLabel, type SortMode } from './filter'
import type { SocialSearchEntry } from '../data/socials'
import type { AdoptListing } from './types'
import { MISSING_PRICE } from './domain'

function listing(id: number, overrides: Partial<AdoptListing> = {}): AdoptListing {
  return { adoptId: id, paintersId: 1, productId: 1, ...overrides }
}

const EMPTY = new Set<string>()
const EMPTY_MAP = new Map<number, number>()

function ids(result: AdoptListing[]): number[] {
  return result.map((l) => l.adoptId)
}

describe('compute - tab', () => {
  const rows = [
    listing(1, { isLock: 2 }), // locked
    listing(2, { isLock: 1 }), // isLock=1 → pure unlocked in processing
    listing(3, { isLock: 0 }), // unlocked
  ]

  it('unlocked tab includes isLock=1 but excludes isLock=2', () => {
    expect(ids(compute({ rows, tab: 'unlocked', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP }))).toEqual([2, 3])
  })

  it('locked tab only includes isLock=2', () => {
    expect(ids(compute({ rows, tab: 'locked', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP }))).toEqual([1])
  })

  it('all tab includes every non-self listing', () => {
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP }))).toEqual([1, 2, 3])
  })

  it('wishlist tab keeps only wishlisted, sorted by add-time desc', () => {
    const wl = new Map([[1, 10], [3, 30]])
    expect(ids(compute({ rows, tab: 'wishlist', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '', wishlist: wl }))).toEqual([3, 1])
  })
})

describe('compute - color & race filters', () => {
  const rows = [
    listing(1, { harmonyAdoptColorVos: [{ harmonyColor: { colorName: '红' } }] }),
    listing(2, { harmonyAdoptColorVos: [{ harmonyColor: { colorName: '蓝' } }] }),
    listing(3, { harmonyRace: { raceName: '狼' } }),
    listing(4, { harmonyRace: { raceName: '龙' } }),
  ]

  it('color filter matches any listed color', () => {
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: new Set(['红']), races: EMPTY, query: '', wishlist: EMPTY_MAP }))).toEqual([1])
  })

  it('race filter matches the species the listing belongs to', () => {
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: new Set(['龙']), query: '', wishlist: EMPTY_MAP }))).toEqual([4])
  })

  it("race filter matches the id's species when the joined name disagrees", () => {
    const stale = [listing(1, { raceId: 7, harmonyRace: { raceName: '神秘生物' } })]
    expect(ids(compute({ rows: stale, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: new Set(['犬']), query: '', wishlist: EMPTY_MAP }))).toEqual([1])
  })

  it('picking 神秘生物 also brings the listings nobody filed', () => {
    const rows = [
      listing(1, { raceId: 26 }),
      listing(2, {}),
      listing(3, { raceId: 2 }),
    ]
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: new Set(['神秘生物']), query: '', wishlist: EMPTY_MAP }))).toEqual([1, 2])
  })

  it('empty color/race sets keep everything', () => {
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP }))).toEqual([1, 2, 3, 4])
  })
})

describe('compute - sort modes', () => {
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

  it('timeDesc sorts by id desc', () => {
    // The fixture gives ids and createTime values that disagree, so the test fails if the sort
    // reads createTime again.
    const rows = [
      listing(1, { createTime: '2024-01-01 10:00:00' }),
      listing(2, { createTime: '2024-03-01 10:00:00' }),
      listing(3, { createTime: '2024-02-01 10:00:00' }),
    ]
    expect(ids(compute({ rows, tab: 'all', sort: 'timeDesc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP }))).toEqual([3, 2, 1])
  })

  it('timeAsc sorts ascending', () => {
    const rows = [
      listing(1, { createTime: '2024-01-01 10:00:00' }),
      listing(2, { createTime: '2024-03-01 10:00:00' }),
    ]
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP }))).toEqual([1, 2])
  })

  it('a row with no createTime keeps its place in the id order', () => {
    const rows = [
      listing(10, { createTime: '2024-01-01 10:00:00' }),
      listing(20),
      listing(30, { createTime: '2024-03-01 10:00:00' }),
    ]
    const at = (sort: SortMode) =>
      ids(compute({ rows, tab: 'all', sort, colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP }))
    expect(at('timeDesc')).toEqual([30, 20, 10])
    expect(at('timeAsc')).toEqual([10, 20, 30])
  })
})

describe('compute - search', () => {
  it('matches adoptName or detailDescription, case-insensitive', () => {
    const rows = [
      listing(1, { adoptName: 'Furry Fox' }),
      listing(2, { detailDescription: '一只帅气的狼' }),
      listing(3, { adoptName: '别的东西' }),
    ]
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: 'furry', wishlist: EMPTY_MAP }))).toEqual([1])
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '狼', wishlist: EMPTY_MAP }))).toEqual([2])
  })

  it('empty query keeps everything', () => {
    const rows = [listing(1), listing(2)]
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP }))).toEqual([1, 2])
  })

  it('digits-only query PREFIX-matches adoptId (e.g. 259 finds 259/2594 but not 12594)', () => {
    const rows = [listing(2594), listing(259), listing(12594), listing(42)]
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '259', wishlist: EMPTY_MAP }))).toEqual([259, 2594])
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '42', wishlist: EMPTY_MAP }))).toEqual([42])
  })

  it('digits query unions id match with name/description (e.g. 3 finds "L3D" in description)', () => {
    const rows = [
      listing(1, { adoptName: '狼' }),
      listing(2, { detailDescription: 'L3D 渲染' }),
      listing(3, { adoptName: '某设定' }),
      listing(30, { adoptName: '别的' }),
    ]
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '3', wishlist: EMPTY_MAP }))).toEqual([2, 3, 30])
  })

  it('digits query trims whitespace', () => {
    const rows = [listing(2594), listing(42)]
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '  2594  ', wishlist: EMPTY_MAP }))).toEqual([2594])
  })

  it('non-digits query falls back to name/description search', () => {
    const rows = [listing(2594, { adoptName: 'Furry Fox' }), listing(42, { adoptName: '狼' })]
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: 'Fox', wishlist: EMPTY_MAP }))).toEqual([2594])
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '狼', wishlist: EMPTY_MAP }))).toEqual([42])
  })

  it('digits query with no match returns empty', () => {
    const rows = [listing(2594)]
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '999', wishlist: EMPTY_MAP }))).toEqual([])
  })
})

describe('compute - socials search', () => {
  // fake data - tests must never reference real owner names/handles from production
  const SOCIALS = new Map<number, SocialSearchEntry>([
    [1, { ownerName: 'TestOwnerOne', searchables: ['TestHandleOne'], uidPrefixes: [], hasSocial: true }],
    [2, { ownerName: 'TestOwnerTwo', searchables: [], uidPrefixes: ['12345678'], hasSocial: true }],
  ])
  const rows = [listing(1), listing(2)]

  it('text query matches ownerName', () => {
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: 'TestOwnerOne', wishlist: EMPTY_MAP, socials: SOCIALS }))).toEqual([1])
  })

  it('text query matches an x handle', () => {
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: 'TestHandleOne', wishlist: EMPTY_MAP, socials: SOCIALS }))).toEqual([1])
  })

  it('digit query PREFIX-matches a douyin uid', () => {
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '123', wishlist: EMPTY_MAP, socials: SOCIALS }))).toEqual([2])
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '12345678', wishlist: EMPTY_MAP, socials: SOCIALS }))).toEqual([2])
  })

  it('digit query does NOT substring-match a uid (prefix only)', () => {
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '3456', wishlist: EMPTY_MAP, socials: SOCIALS }))).toEqual([])
  })

  it('absent socials map leaves behavior unchanged', () => {
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: 'TestOwnerOne', wishlist: EMPTY_MAP }))).toEqual([])
  })
})

describe('compute - socialOnly filter', () => {
  // fake data: 1/2 have a processable platform (hasSocial), 3 has an entry but zero
  // platforms (so no account to link to), 4 has no entry at all
  const SOCIALS = new Map<number, SocialSearchEntry>([
    [1, { ownerName: 'TestOwnerOne', searchables: ['TestHandleOne'], uidPrefixes: [], hasSocial: true }],
    [2, { ownerName: 'TestOwnerTwo', searchables: [], uidPrefixes: ['12345678'], hasSocial: true }],
    [3, { ownerName: 'TestOwnerThree', searchables: ['TestOwnerThree'], uidPrefixes: [], hasSocial: false }],
  ])
  const rows = [listing(1), listing(2), listing(3), listing(4)]

  it('keeps only listings with an account to link to (zero-platform entry is not one)', () => {
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP, socials: SOCIALS, socialOnly: true }))).toEqual([1, 2])
  })

  it('applies within the locked tab', () => {
    const locked = [listing(1, { isLock: 2 }), listing(4, { isLock: 2 })]
    expect(ids(compute({ rows: locked, tab: 'locked', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP, socials: SOCIALS, socialOnly: true }))).toEqual([1])
  })

  it('socialOnly absent → unchanged', () => {
    expect(ids(compute({ rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP, socials: SOCIALS }))).toEqual([1, 2, 3, 4])
  })
})

describe('compute - 价格区间', () => {
  // Three priced listings and a fourth with no price: Furmony leaves those at 0.
  const rows = [
    listing(1, { nonrecurringExpense: 20000 }),
    listing(2, { nonrecurringExpense: 22000 }),
    listing(3, { nonrecurringExpense: 26000 }),
    listing(4),
  ]
  const at = (priceRange: [number, number] | null) => ids(compute({
    rows, tab: 'all', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP,
    priceRange,
  }))

  it('keeps the rows between the ends, both ends included', () => {
    expect(at([20000, 22000])).toEqual([1, 2])
  })

  it('drops the row with no price, because there is no number to compare', () => {
    expect(at([0, 90000])).toEqual([1, 2, 3])
  })

  it('leaves the list alone while no range is set', () => {
    expect(at(null)).toEqual([1, 2, 3, 4])
  })

  it('applies within the 收藏 tab, like the other picks', () => {
    const saved = new Map([[1, 5], [3, 4], [4, 3]])
    expect(ids(compute({
      rows, tab: 'wishlist', sort: 'timeAsc', colors: EMPTY, races: EMPTY, query: '',
      wishlist: saved, priceRange: [20000, 20000],
    }))).toEqual([1])
  })
})

describe('hasSocial', () => {
  it('true only for an entry with a processable platform', () => {
    const SOCIALS = new Map<number, SocialSearchEntry>([
      [1, { ownerName: 'TestOwnerOne', searchables: ['TestHandleOne'], uidPrefixes: [], hasSocial: true }],
      [2, { ownerName: 'TestOwnerTwo', searchables: ['TestOwnerTwo'], uidPrefixes: [], hasSocial: false }],
    ])
    expect(hasSocial(1, SOCIALS)).toBe(true)
    expect(hasSocial(2, SOCIALS)).toBe(false)
    expect(hasSocial(99, SOCIALS)).toBe(false)
    expect(hasSocial(1)).toBe(false) // absent socials map
  })
})

describe('compute - semantic group', () => {
  const rows = [listing(1), listing(2), listing(3)]
  const base = { rows, tab: 'all' as const, sort: 'timeAsc' as const, colors: EMPTY, races: EMPTY, query: '', wishlist: EMPTY_MAP }

  it('keeps only the ids it is handed', () => {
    expect(ids(compute({ ...base, only: new Set([2, 3]) }))).toEqual([2, 3])
  })

  it('drops the ids the exact group already showed', () => {
    expect(ids(compute({ ...base, skip: new Set([1]) }))).toEqual([2, 3])
  })

  it('applies both sets at once', () => {
    expect(ids(compute({ ...base, only: new Set([1, 2, 3]), skip: new Set([2]) }))).toEqual([1, 3])
  })

  // The text match is the one filter this group skips: its purpose is the listing whose
  // description never says what the piece looks like. Every other filter still runs.
  it('still filters by color, tab and lock state', () => {
    const colored = [
      listing(1, { harmonyAdoptColorVos: [{ harmonyColor: { colorName: '蓝' } }] }),
      listing(2, { harmonyAdoptColorVos: [{ harmonyColor: { colorName: '红' } }] }),
      listing(3, { harmonyAdoptColorVos: [{ harmonyColor: { colorName: '蓝' } }], isLock: 2 }),
    ]
    expect(ids(compute({ ...base, rows: colored, colors: new Set(['蓝']) }))).toEqual([1, 3])
    expect(ids(compute({ ...base, rows: colored, colors: new Set(['蓝']), tab: 'unlocked' as const }))).toEqual([1])
  })

  it('an empty only set is nothing, not everything', () => {
    expect(ids(compute({ ...base, only: new Set<number>() }))).toEqual([])
  })
})

describe('orderLabel', () => {
  const priced = () => listing(42, { nonrecurringExpense: 24000 })
  const at = (over: Partial<Parameters<typeof orderLabel>[0]> = {}) =>
    orderLabel({ item: priced(), day: '2025-03-14', ranked: false, sort: 'timeDesc', ...over })

  it('shows the posting day in a time order', () => {
    expect(at()).toBe('2025-03-14')
  })

  it('shows the price in a price order', () => {
    expect(at({ sort: 'priceAsc' })).toBe('¥24000')
  })

  it('marks a listing with no price', () => {
    expect(at({ sort: 'priceDesc', item: listing(42) })).toBe(MISSING_PRICE)
  })

  it('falls back to the listing number where no day is readable', () => {
    expect(at({ day: '' })).toBe('#42')
  })

  it('shows nothing when relevance orders the list', () => {
    expect(at({ ranked: true })).toBe('')
  })

  it('shows nothing for a row that holds no listing', () => {
    expect(at({ item: undefined })).toBe('')
  })
})
