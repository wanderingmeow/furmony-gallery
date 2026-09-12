// src/stores/derivedStore.ts - derived memos combining listings + filters + wishlist.
import { createMemo, createRoot } from 'solid-js'
import type { AdoptListing } from '../types'
import { compute, countLockedRemaining } from '../filter'
import { colorNames, isLocked, isSelfCommission, raceName } from '../domain'
import { listings } from './listingsStore'
import { tab, sortMode, selectedColors, selectedRaces, searchText, noSocialOnly } from './filterStore'
import { wishlist } from './wishlistStore'
import { socialSearch } from './socialsStore'

export let filteredListings: () => AdoptListing[]
export let availableColors: () => string[]
export let availableRaces: () => string[]
export let countAll: () => number
export let countUnlocked: () => number
export let countLocked: () => number
export let wishlistCount: () => number
// Locked listings still needing a social entry - the numerator of the locked-tab
// progress badge (剩余/总数) while the no-social debug filter is active.
export let remainingLocked: () => number

// Derived memos are module-level global state - wrap them in a createRoot so
// Solid doesn't warn they'll never be disposed (they're intentionally global).
createRoot(() => {
  filteredListings = createMemo(() => {
    return compute({
      rows: listings(),
      tab: tab(),
      sort: sortMode(),
      colors: selectedColors(),
      races: selectedRaces(),
      query: searchText(),
      wishlist: wishlist(),
      socials: socialSearch(),
      noSocial: noSocialOnly(),
    })
  })

  availableColors = createMemo(() => {
    const all = listings().flatMap(colorNames).filter((c) => c.length > 0)
    return [...new Set(all)].sort()
  })

  availableRaces = createMemo(() => {
    const all = listings().map(raceName).filter((r): r is string => !!r && r.length > 0)
    return [...new Set(all)].sort()
  })

  countAll = createMemo(() => listings().filter((l) => !isSelfCommission(l)).length)
  countUnlocked = createMemo(() => listings().filter((l) => !isLocked(l) && !isSelfCommission(l)).length)
  countLocked = createMemo(() => listings().filter((l) => isLocked(l) && !isSelfCommission(l)).length)
  // locked ∧ no-social - progress numerator; unfiltered by color/race/search
  remainingLocked = createMemo(() => countLockedRemaining(listings(), socialSearch()))
  // total wishlisted count (locked + unlocked merged) for the 收藏 tab
  wishlistCount = createMemo(() => {
    const wl = wishlist()
    return [...wl.keys()].filter((id) => listings().some((x) => x.adoptId === id)).length
  })
})
