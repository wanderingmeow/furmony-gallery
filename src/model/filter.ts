// src/model/filter.ts - what the grid shows: pure filtering and sorting over a list of rows,
// plus the vocabulary that goes with it (tabs, sort modes, labels). No reactivity, no I/O.
import type { AdoptListing } from './types'
import { tr } from '../i18n'
import { listingBlurb, listingName } from './translatedText'
import type { SocialSearchEntry } from '../data/socials'
import {
  colorNames, displayPrice, formatPrice, isLocked, raceName,
} from './domain'
import { keepsByPrice, type PriceRange } from './priceRange'

export type SortMode = 'timeDesc' | 'timeAsc' | 'priceAsc' | 'priceDesc'
export type FilterTab = 'all' | 'unlocked' | 'locked' | 'wishlist'

export const FILTER_TABS: FilterTab[] = ['all', 'unlocked', 'locked', 'wishlist']
export const SORT_MODES: SortMode[] = ['timeDesc', 'timeAsc', 'priceAsc', 'priceDesc']

/** Which way the arrow on a sort button points. */
export const SORT_UP: Record<SortMode, boolean> = {
  priceAsc: true, priceDesc: false, timeAsc: true, timeDesc: false,
}

const SORT_MODE_KEY = {
  priceAsc: 'sort.priceAsc',
  priceDesc: 'sort.priceDesc',
  timeAsc: 'sort.timeAsc',
  timeDesc: 'sort.timeDesc',
} as const

/** What an order is called, in the language on screen. */
export const sortModeLabel = (mode: SortMode): string => tr(SORT_MODE_KEY[mode])

/** A search answer is ranked by the service, and none of our own sorts applies to it. */
export const relevanceLabel = (): string => tr('sort.similarity')

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

const TAB_KEY = {
  all: 'tab.all',
  unlocked: 'tab.unlocked',
  locked: 'tab.locked',
  wishlist: 'tab.wish',
} as const

export const tabLabel = (tab: FilterTab): string => tr(TAB_KEY[tab])

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
  // The price band: the two ends in yuan, both inside. A listing with no price sits outside every
  // band.
  priceRange?: PriceRange | null
  // Keep the listings whose owner has an account we can link to. Only a few dozen listings have one,
  // so this list is short by design, and the panel says so.
  socialOnly?: boolean
  // Keep only these adoptIds. The semantic group reuses every other filter and brings its own text
  // match, because the shelf's descriptions often leave out what the piece looks like.
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
    (listingName(l)?.toLowerCase().includes(q) ?? false) ||
    (listingBlurb(l)?.toLowerCase().includes(q) ?? false) ||
    socialText(l).includes(q) ||
    (digits && (String(l.adoptId).startsWith(q) || uidPrefix(l)))
}

export function compute(o: ComputeOptions): AdoptListing[] {
  const {
    rows, tab, sort, colors, races, query, wishlist, socials, socialOnly, priceRange, only, skip,
    keepOrder,
  } = o
  // A copy: the sort below runs in place, and `rows` is the store's own array.
  let result = rows.slice()

  // Both set filters run first: they are the cheapest test and everything after them works on
  // the smaller list. They apply to every tab, the wishlist early-return included.
  if (only) result = result.filter((l) => only.has(l.adoptId))
  if (skip && skip.size > 0) result = result.filter((l) => !skip.has(l.adoptId))
  if (socialOnly) result = result.filter((l) => hasSocial(l.adoptId, socials))
  if (priceRange) result = result.filter((l) => keepsByPrice(l, priceRange))

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
