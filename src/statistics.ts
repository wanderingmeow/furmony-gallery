// src/statistics.ts — pure statistics derivations for the stats page.
// Mirrors the Swift StatisticsView data helpers (price bins, color/race counts,
// monthly price stats, monthly counts). No DOM, no network — testable.

import type { AdoptListing } from './types'
import { colorNames, raceName, displayPrice, publishDate, isLocked } from './domain'

export type LockFilter = 'all' | 'locked' | 'unlocked'
export const LOCK_FILTERS: LockFilter[] = ['all', 'locked', 'unlocked']
export const LOCK_LABELS: Record<LockFilter, string> = {
  all: '全部',
  locked: '已锁定',
  unlocked: '未锁定',
}

// locked = isLocked() (isLock === 2) — matches Swift isLocked and the app semantics.
export function filterByLock(listings: AdoptListing[], mode: LockFilter): AdoptListing[] {
  switch (mode) {
    case 'locked': return listings.filter(isLocked)
    case 'unlocked': return listings.filter((l) => !isLocked(l))
    default: return listings
  }
}

export interface Bin { label: string; count: number; low: number; high: number }
export interface StatEntry { name: string; count: number }
export interface MonthlyPrice {
  label: string; avg: number; min: number; max: number; p25: number; p75: number; median: number
}
export interface MonthlyCount { label: string; count: number }

// ---- price ----
export function medianPrice(prices: number[]): number {
  const sorted = prices.slice().sort((a, b) => a - b)
  const n = sorted.length
  if (n === 0) return 0
  if (n % 2 === 0) return (sorted[n / 2 - 1] + sorted[n / 2]) / 2
  return sorted[(n - 1) / 2]
}

// Bucket size 2000; labels are `low/1000 - high/1000` (千元), e.g. "0-2".
export function priceBins(prices: number[], bucket = 2000): Bin[] {
  if (prices.length === 0) return []
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (min >= max) return []
  const start = Math.floor(min / bucket) * bucket
  const end = Math.ceil(max / bucket) * bucket
  const bins: Bin[] = []
  let low = start
  while (low < end) {
    const high = low + bucket
    const count = prices.filter((p) => p >= low && p < high).length
    bins.push({ label: `${Math.round(low / 1000)}-${Math.round(high / 1000)}`, count, low, high })
    low = high
  }
  return bins
}

// Bin EDGES (boundaries) for the histogram — the bins are contiguous [low, high),
// so the edges are [bins[0].low] + each bin's high.
export function priceEdges(bins: Bin[]): number[] {
  if (bins.length === 0) return []
  const edges = [bins[0].low]
  for (const b of bins) edges.push(b.high)
  return edges
}

// ---- color / race (sorted desc like Swift) ----
// Shared decision: turn a tally Map into sorted StatEntry[] (desc). The counting
// loops stay local (color is multi-key per listing, race is single-key).
function toSortedEntries(counts: Map<string, number>): StatEntry[] {
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
}

export function colorCounts(listings: AdoptListing[]): StatEntry[] {
  const counts = new Map<string, number>()
  for (const l of listings) {
    for (const name of colorNames(l)) counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return toSortedEntries(counts)
}

export function raceCounts(listings: AdoptListing[]): StatEntry[] {
  const counts = new Map<string, number>()
  for (const l of listings) {
    const name = raceName(l) ?? '神秘生物'
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return toSortedEntries(counts)
}

// ---- monthly ----
// "YY/MM" -> "XX年X月" (e.g. "24/03" -> "24年3月"); year stays 2-digit, month
// drops the leading zero (10/11/12 keep two digits).
export function fmtMonth(label: string): string {
  const [yy, mm] = label.split('/')
  return `${yy}年${parseInt(mm, 10)}月`
}

// Month key "YY/MM" (year % 100, zero-padded) — lexicographic sort == chronological.
function monthKey(createTime: string): string {
  const d = publishDate({ createTime } as AdoptListing)
  if (d) {
    const yy = String(d.getFullYear() % 100).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${yy}/${mm}`
  }
  // fallback (mirrors Swift dropFirst(2)/dropFirst(5)): "25" + "/" + "06"
  return createTime.slice(2, 4) + '/' + createTime.slice(5, 7)
}

function percentile(sorted: number[], p: number): number {
  const n = sorted.length
  if (n === 0) return 0
  if (n === 1) return sorted[0]
  const rank = p * (n - 1)
  const lower = Math.floor(rank)
  const frac = rank - lower
  const upper = Math.min(lower + 1, n - 1)
  return sorted[lower] + (sorted[upper] - sorted[lower]) * frac
}

// Group listings into month-keyed buckets, sorted ascending (lexicographic order
// == chronological). `keyOf` returns the month key or null to skip; `valueOf`
// picks the value collected per bucket. Shared by the two monthly derivations.
function groupByMonth<T, V>(
  items: T[],
  keyOf: (item: T) => string | null,
  valueOf: (item: T) => V,
): [string, V[]][] {
  const groups = new Map<string, V[]>()
  for (const item of items) {
    const key = keyOf(item)
    if (key == null) continue
    const arr = groups.get(key) ?? []
    arr.push(valueOf(item))
    groups.set(key, arr)
  }
  return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
}

export function monthlyPriceStats(listings: AdoptListing[]): MonthlyPrice[] {
  return groupByMonth(
    listings,
    (l) => (displayPrice(l) > 0 && l.createTime) ? monthKey(l.createTime) : null,
    displayPrice,
  ).map(([label, prices]) => {
    const sorted = prices.slice().sort((a, b) => a - b)
    const sum = prices.reduce((acc, p) => acc + p, 0)
    return {
      label,
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      p25: percentile(sorted, 0.25),
      p75: percentile(sorted, 0.75),
      median: percentile(sorted, 0.5),
      avg: sum / prices.length,
    }
  })
}

export function monthlyCounts(listings: AdoptListing[]): MonthlyCount[] {
  return groupByMonth(
    listings,
    (l) => l.createTime ? monthKey(l.createTime) : null,
    (l) => l,
  ).map(([label, rows]) => ({ label, count: rows.length }))
}
