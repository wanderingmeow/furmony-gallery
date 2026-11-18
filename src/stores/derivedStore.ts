// src/stores/derivedStore.ts - everything the grid and the tab badges read, in one pass from
// listings + filters + wishlist + what the enhanced search returned.
import { createEffect, createMemo, createRoot, createSignal, on } from 'solid-js'
import type { AdoptListing } from '../model/types'
import { compute, countLockedRemaining } from '../model/filter'
import { colorNames, isLocked, isSelfCommission, raceName } from '../model/domain'
import { listings } from './listingsStore'
import { tab, sortMode, selectedColors, selectedRaces, searchText, noSocialOnly } from './filterStore'
import { wishlist } from './wishlistStore'
import { socialSearch } from './socialsStore'
import { route, semanticActive, semanticPending } from './semanticStore'

export let filteredListings: () => AdoptListing[]
export let availableColors: () => string[]
export let availableRaces: () => string[]
export let countAll: () => number
export let countUnlocked: () => number
export let countLocked: () => number
export let wishlistCount: () => number
// Locked listings still needing a social entry - the numerator of the locked-tab progress
// badge (剩余/总数) while the no-social debug filter is active.
export let remainingLocked: () => number

/** Code that needs the answer to "what would this list look like" starts here, so a new filter
 *  dimension is added in one place.
 */
export function listFilterBase() {
  return {
    rows: listings(),
    tab: tab(),
    sort: sortMode(),
    colors: selectedColors(),
    races: selectedRaces(),
    wishlist: wishlist(),
    socials: socialSearch(),
    noSocial: noSocialOnly(),
    // A semantic result list is ordered by relevance, so the sort buttons are hidden while
    // one is on screen - and hiding them would be a lie if the sort still applied.
    keepOrder: semanticActive(),
  }
}

// Global on purpose: nothing disposes these memos, and createRoot keeps Solid from warning
// about that.
createRoot(() => {
  /** The model's own order. `only` filters, it does not order: without this the hits come back
   *  in feed order and the ranking the reader asked for is gone. */
  const byRank = (rank: Map<number, number>) =>
    (a: AdoptListing, b: AdoptListing) => rank.get(a.adoptId)! - rank.get(b.adoptId)!

  const sortedUnique = (values: string[]) => [...new Set(values)].sort()

  const merged = createMemo<AdoptListing[]>(() => {
    const r = route()
    const ids = r.by === 'none' ? [] : r.ids
    const rank = new Map(ids.map((id, i) => [id, i]))
    // A photograph is the whole query: there is no exact-match group in front of it, and
    // leading with the plain list would bury the answer somewhere near the end.
    //
    // `only` still runs every other filter over the hits: a locked listing does not join a
    // picture's results because the picture happened to look like it.
    if (r.by === 'picture') {
      return compute({ ...listFilterBase(), query: '', only: new Set(ids), keepOrder: true })
        .sort(byRank(rank))
    }
    const exact = compute({ ...listFilterBase(), query: searchText() })
    if (ids.length === 0) return exact
    // Exact matches first, the model's neighbors after them. The second group keeps every
    // other filter but the text match - its whole purpose is the listing whose description
    // never says what it looks like.
    const similar = compute({
      ...listFilterBase(),
      query: '',
      only: new Set(ids),
      skip: new Set(exact.map((l) => l.adoptId)),
      keepOrder: true,
    }).sort(byRank(rank))
    return [...exact, ...similar]
  })

  // One paint per query: while the model is thinking the grid keeps the picture it already
  // had, so the neighbors arrive with the exact matches instead of the list growing twice.
  const [held, setHeld] = createSignal<AdoptListing[]>([])
  createEffect(on([merged, semanticPending], ([list, waiting]) => {
    if (!waiting) setHeld(list as AdoptListing[])
  }, { defer: true }))
  filteredListings = createMemo(() => (semanticPending() ? held() : merged()))

  availableColors = createMemo(() =>
    sortedUnique(listings().flatMap(colorNames).filter((c) => c.length > 0)))
  availableRaces = createMemo(() =>
    sortedUnique(listings().map(raceName).filter((r): r is string => !!r)))

  // Self-commission pieces are in no count, whichever tab is looking.
  const shoppable = createMemo(() => listings().filter((l) => !isSelfCommission(l)))
  countAll = createMemo(() => shoppable().length)
  countUnlocked = createMemo(() => shoppable().filter((l) => !isLocked(l)).length)
  countLocked = createMemo(() => shoppable().filter((l) => isLocked(l)).length)
  remainingLocked = createMemo(() => countLockedRemaining(listings(), socialSearch()))

  // A wishlist outlives the feed: it keeps ids that are no longer on the shelf, and the tab
  // counts what it can actually show.
  wishlistCount = createMemo(() => {
    const onShelf = new Set(listings().map((l) => l.adoptId))
    return [...wishlist().keys()].filter((id) => onShelf.has(id)).length
  })
})

/** True when the picks are what emptied the list. Only the empty state calls it, so a plain
 *  call is enough. */
export function matchesWithoutPicks(query: string): boolean {
  return compute({ ...listFilterBase(), colors: new Set(), races: new Set(), query }).length > 0
}
