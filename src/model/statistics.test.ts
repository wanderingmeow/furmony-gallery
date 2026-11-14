import { describe, expect, it } from 'vitest'
import type { AdoptListing } from './types'
import {
  filterByLock, priceBins, medianPrice, colorCounts, raceCounts,
  monthlyPriceStats, monthlyCounts,
} from './statistics'

function listing(over: Partial<AdoptListing>): AdoptListing {
  return {
    adoptId: 1, paintersId: 0, productId: 0,
    nonrecurringExpense: 1000,
    isLock: 0,
    createTime: '2025-06-15 10:00:00',
    harmonyAdoptColorVos: [],
    ...over,
  }
}

describe('filterByLock', () => {
  const rows = [
    listing({ adoptId: 1, isLock: 2 }),
    listing({ adoptId: 2, isLock: 1 }),
    listing({ adoptId: 3, isLock: 0 }),
  ]
  it('all keeps everything', () => expect(filterByLock(rows, 'all').length).toBe(3))
  it('locked = isLock 2 only', () => expect(filterByLock(rows, 'locked').map((l) => l.adoptId)).toEqual([1]))
  it('unlocked = not isLock 2 (1 counts as unlocked)', () => {
    expect(filterByLock(rows, 'unlocked').map((l) => l.adoptId)).toEqual([2, 3])
  })
})

describe('medianPrice', () => {
  it('odd count', () => expect(medianPrice([1, 2, 3])).toBe(2))
  it('even count averages the middle two', () => expect(medianPrice([1, 2, 3, 4])).toBe(2.5))
  it('empty -> 0', () => expect(medianPrice([])).toBe(0))
})

describe('priceBins', () => {
  it('buckets by 2000 with 千元 labels', () => {
    const bins = priceBins([500, 1500, 2500, 3500])
    expect(bins.map((b) => b.label)).toEqual(['0-2', '2-4'])
    expect(bins.map((b) => b.count)).toEqual([2, 2])
  })
  it('empty -> []', () => expect(priceBins([])).toEqual([]))
  it('single distinct value -> []', () => expect(priceBins([1000, 1000])).toEqual([]))
})

describe('colorCounts / raceCounts', () => {
  it('colorCounts tallies every color name, sorted desc', () => {
    const rows = [
      listing({ adoptId: 1, harmonyAdoptColorVos: [{ harmonyColor: { colorName: '红' } }, { harmonyColor: { colorName: '黑' } }] }),
      listing({ adoptId: 2, harmonyAdoptColorVos: [{ harmonyColor: { colorName: '红' } }] }),
    ]
    expect(colorCounts(rows)).toEqual([{ name: '红', count: 2 }, { name: '黑', count: 1 }])
  })
  it('raceCounts falls back to 神秘生物', () => {
    const rows = [
      listing({ adoptId: 1, harmonyRace: { raceName: '狼' } }),
      listing({ adoptId: 2 }),
    ]
    expect(raceCounts(rows)).toEqual([{ name: '狼', count: 1 }, { name: '神秘生物', count: 1 }])
  })
})

describe('monthlyPriceStats', () => {
  it('groups by YY/MM, sorted, computes avg/p25/p75/median', () => {
    const rows = [
      listing({ adoptId: 1, nonrecurringExpense: 100, createTime: '2025-06-01 10:00:00' }),
      listing({ adoptId: 2, nonrecurringExpense: 300, createTime: '2025-06-02 10:00:00' }),
      listing({ adoptId: 3, nonrecurringExpense: 200, createTime: '2025-07-01 10:00:00' }),
    ]
    const stats = monthlyPriceStats(rows)
    expect(stats.map((s) => s.label)).toEqual(['25/06', '25/07'])
    expect(stats[0].avg).toBe(200)
    expect(stats[0].min).toBe(100)
    expect(stats[0].max).toBe(300)
    expect(stats[0].p25).toBeCloseTo(150, 5)
    expect(stats[0].median).toBe(200)
  })
  it('skips non-positive prices', () => {
    const rows = [listing({ adoptId: 1, nonrecurringExpense: 0 }), listing({ adoptId: 2, nonrecurringExpense: 100 })]
    expect(monthlyPriceStats(rows).length).toBe(1)
  })
})

describe('monthlyCounts', () => {
  it('counts per month, sorted', () => {
    const rows = [
      listing({ adoptId: 1, createTime: '2025-06-01 10:00:00' }),
      listing({ adoptId: 2, createTime: '2025-06-02 10:00:00' }),
      listing({ adoptId: 3, createTime: '2025-07-01 10:00:00' }),
    ]
    expect(monthlyCounts(rows)).toEqual([{ label: '25/06', count: 2 }, { label: '25/07', count: 1 }])
  })
})
