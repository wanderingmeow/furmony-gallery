// Pure filtering/sorting layer (no reactivity, no I/O) — unit-testable in isolation.
// Also owns the filter-domain vocabulary (tabs, sort modes, labels) so consumers import
// these from the filter domain rather than a generic utils module.
import type { AdoptListing } from './types'
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
  wishlist: '心愿单',
}

export function compute(
  listings: AdoptListing[],
  tab: FilterTab,
  sortMode: SortMode,
  selectedColors: Set<string>,
  selectedRaces: Set<string>,
  searchText: string,
  wishlist: Map<number, number>,
): AdoptListing[] {
  let result = listings.filter((l) => !isSelfCommission(l))

  if (selectedColors.size > 0) {
    result = result.filter((l) => {
      const cols = colorNames(l)
      return cols.length > 0 && cols.some((c) => selectedColors.has(c))
    })
  }
  if (selectedRaces.size > 0) {
    result = result.filter((l) => {
      const r = raceName(l)
      return !!r && selectedRaces.has(r)
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

  switch (sortMode) {
    case 'timeDesc': result.sort((a, b) => (publishDate(a)?.getTime() ?? 0) > (publishDate(b)?.getTime() ?? 0) ? -1 : 1); break
    case 'timeAsc': result.sort((a, b) => (publishDate(a)?.getTime() ?? 0) < (publishDate(b)?.getTime() ?? 0) ? -1 : 1); break
    case 'priceAsc': result.sort((a, b) => displayPrice(a) - displayPrice(b)); break
    case 'priceDesc': result.sort((a, b) => displayPrice(b) - displayPrice(a)); break
  }

  if (searchText) {
    const q = searchText.trim().toLowerCase()
    const byText = (l: AdoptListing) =>
      (l.adoptName?.toLowerCase().includes(q) ?? false) ||
      (l.detailDescription?.toLowerCase().includes(q) ?? false)
    // digits-only input → union of id substring match AND name/description match
    // (e.g. "3" also finds a listing whose description mentions "L3D")
    const isDigit = /^\d+$/.test(q);
    if (isDigit) {
      result = result.filter((l) => String(l.adoptId).includes(q) || byText(l))
    } else {
      result = result.filter(byText)
    }
  }
  return result
}
