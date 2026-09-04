// Pure filtering/sorting layer (no reactivity, no I/O) — unit-testable in isolation.
// Also owns the filter-domain vocabulary (tabs, sort modes, labels) so consumers import
// these from the filter domain rather than a generic utils module.
import type { AdoptListing } from './types'
import type { SocialSearchEntry } from './socials'
import {
  colorNames, displayPrice, isLocked, isSelfCommission, publishDate, raceName,
} from './domain'

export type SortMode = 'timeDesc' | 'timeAsc' | 'priceAsc' | 'priceDesc'
export type FilterTab = 'all' | 'unlocked' | 'locked' | 'wishlist'

export const FILTER_TABS: FilterTab[] = ['all', 'unlocked', 'locked', 'wishlist']
export const SORT_MODES: SortMode[] = ['timeDesc', 'timeAsc', 'priceAsc', 'priceDesc']

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
}

export function compute(o: ComputeOptions): AdoptListing[] {
  const { rows, tab, sort, colors, races, query, wishlist, socials } = o
  let result = rows.filter((l) => !isSelfCommission(l))

  if (colors.size > 0) {
    result = result.filter((l) => {
      const cols = colorNames(l)
      return cols.length > 0 && cols.some((c) => colors.has(c))
    })
  }
  if (races.size > 0) {
    result = result.filter((l) => {
      const r = raceName(l)
      return !!r && races.has(r)
    })
  }

  switch (tab) {
    case 'unlocked': result = result.filter((l) => !isLocked(l)); break
    case 'locked': result = result.filter((l) => isLocked(l)); break
    case 'wishlist': {
      result = result.filter((l) => wishlist.has(l.adoptId))
      result.sort((a, b) => (wishlist.get(a.adoptId) ?? 0) > (wishlist.get(b.adoptId) ?? 0) ? -1 : 1)
      return result
    }
    case 'all': break
  }

  switch (sort) {
    case 'timeDesc': result.sort((a, b) => (publishDate(a)?.getTime() ?? 0) > (publishDate(b)?.getTime() ?? 0) ? -1 : 1); break
    case 'timeAsc': result.sort((a, b) => (publishDate(a)?.getTime() ?? 0) < (publishDate(b)?.getTime() ?? 0) ? -1 : 1); break
    case 'priceAsc': result.sort((a, b) => displayPrice(a) - displayPrice(b)); break
    case 'priceDesc': result.sort((a, b) => displayPrice(b) - displayPrice(a)); break
  }

  if (query) {
    const q = query.trim().toLowerCase()
    const socialText = (l: AdoptListing) => {
      const s = socials?.get(l.adoptId)
      return s ? `${s.ownerName} ${s.searchables.join(' ')}`.toLowerCase() : ''
    }
    const uidPrefix = (l: AdoptListing) => {
      const s = socials?.get(l.adoptId)
      return s ? s.uidPrefixes.some((u) => u.toLowerCase().startsWith(q)) : false
    }
    const byText = (l: AdoptListing) =>
      (l.adoptName?.toLowerCase().includes(q) ?? false) ||
      (l.detailDescription?.toLowerCase().includes(q) ?? false) ||
      socialText(l).includes(q)
    // digits-only input: adoptId PREFIX match, plus text match (name/description + owner/handles,
    // substring) plus numeric social-uid PREFIX match (bilibili/douyin/xiaohongshu).
    const isDigit = /^\d+$/.test(q);
    if (isDigit) {
      result = result.filter((l) => String(l.adoptId).startsWith(q) || byText(l) || uidPrefix(l))
    } else {
      result = result.filter(byText)
    }
  }
  return result
}
