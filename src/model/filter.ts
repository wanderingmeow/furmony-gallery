// src/model/filter.ts - what the grid shows: pure filtering and sorting over a list of rows,
// plus the vocabulary that goes with it (tabs, sort modes, labels). No reactivity, no I/O.
import type { AdoptListing } from './types'
import type { SocialSearchEntry } from '../data/socials'
import {
  colorNames, displayPrice, formatPrice, isLocked, isSelfCommission, raceName,
} from './domain'

export type SortMode = 'timeDesc' | 'timeAsc' | 'priceAsc' | 'priceDesc'
export type FilterTab = 'all' | 'unlocked' | 'locked' | 'wishlist'

export const FILTER_TABS: FilterTab[] = ['all', 'unlocked', 'locked', 'wishlist']
export const SORT_MODES: SortMode[] = ['timeDesc', 'timeAsc', 'priceAsc', 'priceDesc']

/** For each mode: which way the arrow points, and the words for the button's title. */
export const SORT_FACE: Record<SortMode, { up: boolean; say: string }> = {
  priceAsc: { up: true, say: '价格从低到高' },
  priceDesc: { up: false, say: '价格从高到低' },
  timeAsc: { up: true, say: '时间从旧到新' },
  timeDesc: { up: false, say: '时间从新到旧' },
}

/** A search answer is ranked by the service, and none of our own sorts applies to it. */
export const RELEVANCE_SAY = '按相似度从高到低'

/** What the preview at the right edge reads out about a row: the price in a price order, the
 *  posting day otherwise, and the listing's own number when no day is readable.
 *
 *  An order by relevance has no such value, so `ranked` gives an empty string. */
export function orderLabel(a: {
  item: AdoptListing | undefined
  day: string
  ranked: boolean
  sort: SortMode
}): string {
  if (a.ranked || !a.item) return ''
  if (a.sort === 'priceAsc' || a.sort === 'priceDesc') return formatPrice(displayPrice(a.item))
  return a.day || `#${a.item.adoptId}`
}

export const TAB_LABELS: Record<FilterTab, string> = {
  all: '全部',
  unlocked: '未锁定',
  locked: '已锁定',
  wishlist: '收藏',
}

export interface ComputeOptions {
  rows: AdoptListing[]
  tab: FilterTab
  sort: SortMode
  colors: Set<string>
  races: Set<string>
  query: string
  wishlist: Map<number, number>
  // owner/account search text, keyed by adoptId
  socials?: Map<number, SocialSearchEntry>
  // 只显示有主人账号的: leave the listings whose owner has an account we can link to. Only a
  // few dozen listings have one, so this list is short by design - the panel says so.
  socialOnly?: boolean
  // keep only these adoptIds - the semantic group reuses every filter but its own text
  // match, because 68% of the descriptions never mention what the piece looks like
  only?: Set<number>
  // drop these adoptIds, so the semantic group does not repeat the exact matches
  skip?: Set<number>
  // the caller already ordered the rows: a semantic result list IS its own order, and
  // re-sorting it by price would quietly undo the ranking the reader asked for
  keepOrder?: boolean
}

// The time order is the id order. On the full list an id and a publish time agree on every row
// that has a time at all, and an id is never missing, so a row without one keeps the place that
// its neighbors hold.
const timeRank = (l: AdoptListing) => l.adoptId

const by = (key: (l: AdoptListing) => number) => (a: AdoptListing, b: AdoptListing) => key(a) - key(b)

const SORTS: Record<SortMode, (a: AdoptListing, b: AdoptListing) => number> = {
  timeDesc: by((l) => -timeRank(l)),
  timeAsc: by(timeRank),
  priceAsc: by(displayPrice),
  priceDesc: by((l) => -displayPrice(l)),
}

/** The text match. Digits open two extra doors - a partial 编号 and a partial handle - because
 *  those are what people type from memory, and both are matched as prefixes, not substrings. */
function matchesQuery(query: string, socials?: Map<number, SocialSearchEntry>) {
  const q = query.trim().toLowerCase()
  const digits = /^\d+$/.test(q)
  const socialText = (l: AdoptListing) => {
    const s = socials?.get(l.adoptId)
    return s ? `${s.ownerName} ${s.searchables.join(' ')}`.toLowerCase() : ''
  }
  const uidPrefix = (l: AdoptListing) => {
    const s = socials?.get(l.adoptId)
    return !!s && s.uidPrefixes.some((u) => u.toLowerCase().startsWith(q))
  }
  return (l: AdoptListing) =>
    (l.adoptName?.toLowerCase().includes(q) ?? false) ||
    (l.detailDescription?.toLowerCase().includes(q) ?? false) ||
    socialText(l).includes(q) ||
    (digits && (String(l.adoptId).startsWith(q) || uidPrefix(l)))
}

export function compute(o: ComputeOptions): AdoptListing[] {
  const { rows, tab, sort, colors, races, query, wishlist, socials, socialOnly, only, skip, keepOrder } = o
  let result = rows.filter((l) => !isSelfCommission(l))

  // Both set filters run first: they are the cheapest test and everything after them works on
  // the smaller list. They apply to every tab, the wishlist early-return included.
  if (only) result = result.filter((l) => only.has(l.adoptId))
  if (skip && skip.size > 0) result = result.filter((l) => !skip.has(l.adoptId))
  if (socialOnly) result = result.filter((l) => hasSocial(l.adoptId, socials))

  if (colors.size > 0) result = result.filter((l) => colorNames(l).some((c) => colors.has(c)))
  if (races.size > 0) {
    result = result.filter((l) => {
      const r = raceName(l)
      return !!r && races.has(r)
    })
  }

  switch (tab) {
    case 'unlocked': result = result.filter((l) => !isLocked(l)); break
    case 'locked': result = result.filter((l) => isLocked(l)); break
    case 'wishlist':
      // The 收藏 tab keeps the order it was added in whatever `keepOrder` says: that order is
      // what the tab is, not a sort the reader can switch off.
      return result
        .filter((l) => wishlist.has(l.adoptId))
        .sort(by((l) => -(wishlist.get(l.adoptId) ?? 0)))
    case 'all': break
  }

  if (!keepOrder) result.sort(SORTS[sort])
  if (query) result = result.filter(matchesQuery(query, socials))
  return result
}

/** Whether the owner of this listing has an account we can link to. An entry with zero
 *  processable platforms counts as having none: 主人 would show a name with nothing to open. */
export function hasSocial(id: number, socials?: Map<number, SocialSearchEntry>): boolean {
  return socials?.get(id)?.hasSocial === true
}
