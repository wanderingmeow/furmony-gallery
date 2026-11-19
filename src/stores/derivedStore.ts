// src/stores/derivedStore.ts - everything the grid and the tab badges read, in one pass from
// listings + filters + wishlist + what the enhanced search returned.
import { batch, createEffect, createMemo, createRoot, createSignal, on } from 'solid-js'
import type { AdoptListing } from '../model/types'
import { compute, hasSocial } from '../model/filter'
import { colorNames, isLocked, raceName } from '../model/domain'
import { browserLocale, requestedLocale, setLocale } from '../i18n'
import type { PriceRange } from '../model/priceRange'
import { pickEmptyState, type EmptyAction, type EmptyState as EmptyChoice } from '../model/emptyState'
import { createPriceFacet, type PriceFacet } from './priceFacet'
import { fetchFailed, listings, loadData } from './listingsStore'
import {
  DEFAULT_SORT, priceRange, selectedColors, selectedRaces, setPriceRange, setSearchText,
  setSelectedColors, setSelectedRaces, setSocialOnly, setSortMode, socialOnly, searchText, sortMode,
  tab,
} from './filterStore'
import {
  DEFAULT_PRICE_MODE, priceMode, semanticSearch, setPriceMode, setSemanticSearch,
} from './displayStore'
import { wishlist } from './wishlistStore'
import { socialSearch } from './socialsStore'
import {
  askFailure, picture, pictureAnswers, pictureMeaning, retryAsk, route, semanticActive,
  semanticPending,
} from './semanticStore'

export let filteredListings: () => AdoptListing[]
export let availableColors: () => string[]
export let availableRaces: () => string[]
export let countAll: () => number
export let countUnlocked: () => number
export let countLocked: () => number
export let wishlistCount: () => number
/** Whether socials.json brought in anything usable. Without the table every listing reads as
 *  having no owner account, so the filter would empty the list and look like the reader's own
 *  mistake. */
export let socialsReady: () => boolean
/** How many listings on the shelf have an account we can link to. The panel names this number
 *  before the switch cuts the list down to it. */
export let socialCount: () => number
/** The 主人账号 filter as the list runs it. With socials.json missing, `hasSocial` is false for
 *  every listing, so a switch left on would empty the page. A switch on with nothing to filter on
 *  is not on. */
export let socialFilterOn: () => boolean
/** What the 价格区间 block reads: the bars, where a thumb may rest, and what the band keeps. */
export let price: PriceFacet
/** Why the list is empty and the one thing the reader can press, or null while there is nothing
 *  to say. The empty state box shows this and nothing else. */
export let emptyState: () => EmptyChoice | null

/**
 * Every filter the page runs with, in the shape `compute` takes. Each list on the screen starts
 * from here, so a filter is read in one place.
 *
 * `band` is the price range to run with. The default is the one on screen; the price facet passes
 * null to get the same list with its own filter left out.
 */
export function listFilterBase(band: PriceRange | null = price.effective()) {
  return {
    rows: listings(),
    // A photograph's answer belongs to no tab: one picture returns locked and unlocked listings
    // together. The other filters still apply, because the reader can reach their panel.
    tab: pictureAnswers() ? 'all' : tab(),
    sort: sortMode(),
    colors: selectedColors(),
    races: selectedRaces(),
    wishlist: wishlist(),
    socials: socialSearch(),
    socialOnly: socialFilterOn(),
    priceRange: band,
    // A semantic result list is ordered by relevance, so the sort buttons are hidden while
    // one is on screen - and hiding them would be a lie if the sort still applied.
    keepOrder: semanticActive(),
  }
}

// Global on purpose: nothing disposes these memos, and createRoot keeps Solid from warning
// about that.
createRoot(() => {
  // These three are created first. `listWith` below calls `listFilterBase()`, which reads
  // `socialFilterOn`, and a memo created after that call would still be undefined inside it.
  socialsReady = createMemo(() => socialSearch().size > 0)
  socialCount = createMemo(() =>
    listings().filter((l) => hasSocial(l.adoptId, socialSearch())).length)
  socialFilterOn = createMemo(() => socialOnly() && socialsReady())

  /** The model's own order. `only` filters, it does not order: without this the hits come back
   *  in feed order and the ranking the reader asked for is gone. */
  const byRank = (rank: Map<number, number>) =>
    (a: AdoptListing, b: AdoptListing) => rank.get(a.adoptId)! - rank.get(b.adoptId)!

  const sortedUnique = (values: string[]) => [...new Set(values)].sort()

  /** The panel's own picks. The price grid leaves them out, so the grid is the tab's shape: a
   *  species with nothing to show still leaves the reader a band to widen. */
  const NO_PANEL_PICKS = { colors: new Set<string>(), races: new Set<string>(), socialOnly: false }
  const WIDE = true

  /** The page's list under one price band: the exact matches, then the model's neighbors. */
  const listWith = (band: PriceRange | null, wide = false): AdoptListing[] => {
    const r = route()
    const ids = r.by === 'none' ? [] : r.ids
    const rank = new Map(ids.map((id, i) => [id, i]))
    const base = wide ? { ...listFilterBase(band), ...NO_PANEL_PICKS } : listFilterBase(band)
    // A photograph is the whole query: there is no exact-match group in front of it, and
    // leading with the plain list would bury the answer somewhere near the end.
    //
    // `only` still runs every other filter over the hits: a locked listing does not join a
    // picture's results because the picture happened to look like it.
    if (r.by === 'picture') {
      return compute({ ...base, query: '', only: new Set(ids), keepOrder: true })
        .sort(byRank(rank))
    }
    const exact = compute({ ...base, query: wide ? '' : searchText() })
    if (ids.length === 0) return exact
    // Exact matches first, the model's neighbors after them. The second group keeps every
    // other filter but the text match - its whole purpose is the listing whose description
    // never says what it looks like.
    const similar = compute({
      ...base,
      query: '',
      only: new Set(ids),
      skip: new Set(exact.map((l) => l.adoptId)),
      keepOrder: true,
    }).sort(byRank(rank))
    return [...exact, ...similar]
  }

  // The grid is the tab's own list, and the bars and the count read the list on screen, both with
  // the band off. The facet is built before `merged` because a memo reads its inputs once at
  // creation, and `merged` needs the band that the facet holds.
  price = createPriceFacet(() => listWith(null, WIDE), () => listWith(null), priceRange)

  const merged = createMemo(() => listWith(price.effective()))

  // One paint per query: while the model is thinking the grid keeps the picture it already had, so
  // the neighbors arrive with the exact matches and the list paints once.
  const [held, setHeld] = createSignal<AdoptListing[]>([])
  createEffect(on([merged, semanticPending], ([list, waiting]) => {
    if (!waiting) setHeld(list as AdoptListing[])
  }, { defer: true }))
  filteredListings = createMemo(() => (semanticPending() ? held() : merged()))

  availableColors = createMemo(() =>
    sortedUnique(listings().flatMap(colorNames).filter((c) => c.length > 0)))
  availableRaces = createMemo(() =>
    sortedUnique(listings().map(raceName).filter((r): r is string => !!r)))

  countAll = createMemo(() => listings().length)
  countUnlocked = createMemo(() => listings().filter((l) => !isLocked(l)).length)
  countLocked = createMemo(() => listings().filter((l) => isLocked(l)).length)
  // A wishlist outlives the feed: it keeps ids that are no longer on the shelf, and the tab
  // counts what it can actually show.
  wishlistCount = createMemo(() => {
    const onShelf = new Set(listings().map((l) => l.adoptId))
    return [...wishlist().keys()].filter((id) => onShelf.has(id)).length
  })

  emptyState = createMemo(() => {
    const query = searchText().trim()
    const picked = selectedColors().size + selectedRaces().size + (price.on() ? 1 : 0)
    const say = picture.on() ? pictureMeaning() : 'nothing'
    return pickEmptyState({
      loadFailed: fetchFailed(),
      asking: semanticPending() || say === 'working',
      socialOnly: socialFilterOn(),
      // A photograph's answer covers every tab, so the wishlist's own wording applies only while
      // the tab row is on screen.
      onWishlistTab: !pictureAnswers() && tab() === 'wishlist',
      savedCount: wishlistCount(),
      query,
      picked,
      filtersAreTheCause: picked > 0 && matchesWithoutPicks(query),
      pictureSay: say === 'failed' || say === 'noMatch' ? say : null,
      sentenceFailed: askFailure(),
    })
  })
})

/** True when the picks are what emptied the list: the colors, the species and the price range off,
 *  the words still on. Only the empty state calls it, so a plain call is enough. */
export function matchesWithoutPicks(query: string): boolean {
  return compute({
    ...listFilterBase(null), colors: new Set(), races: new Set(), query,
  }).length > 0
}

/** Run the action the empty state named. Every action is a store call, so this is the only place
 *  that maps an action to what it does, and no empty state needs the router. */
export function applyEmptyAction(action: EmptyAction): void {
  switch (action) {
    case 'search':
      setSearchText('')
      return
    case 'filters':
      batch(() => {
        setSelectedColors(new Set())
        setSelectedRaces(new Set())
        setPriceRange(null)
      })
      return
    case 'retry':
      void loadData()
      return
    case 'retryAsk':
      // The words stay in the input: the service never saw them.
      retryAsk()
      return
    case 'socialOnly':
      setSocialOnly(false)
  }
}

/** How many filters are on. The number on the corner button and the 重置 row both read this, so
 *  the two cannot disagree. The 主人账号 switch counts while it runs, not while the flag sits in
 *  storage with nothing to filter on. */
export function filtersOnCount(): number {
  return selectedColors().size + selectedRaces().size + (socialFilterOn() ? 1 : 0)
    + (price.on() ? 1 : 0)
}

/** Every row the panel offers, back to the state the page starts in: the order, the picks, the
 *  主人账号 switch, the price range, the price display, the search switch. The query stays,
 *  because the input carries its own ✕, and the tab stays, because it sits outside the panel. */
export function resetPanel(): void {
  batch(() => {
    setSortMode(DEFAULT_SORT)
    setSelectedColors(new Set())
    setSelectedRaces(new Set())
    setSocialOnly(false)
    setPriceRange(null)
    setPriceMode(DEFAULT_PRICE_MODE)
    setSemanticSearch(false)
    setLocale(browserLocale())
  })
}

/** The three settings that change how the list reads but hide no listing: the order, the price
 *  display, the search switch. Because they hide nothing, the number on the corner stays empty
 *  while the reader is still one tap away from wanting them back. */
function prefsChanged(): boolean {
  return sortMode() !== DEFAULT_SORT || priceMode() !== DEFAULT_PRICE_MODE || semanticSearch()
    || requestedLocale() !== browserLocale()
}

/** Whether 重置 has anything to give back. */
export function panelHasChanges(): boolean {
  return filtersOnCount() > 0 || prefsChanged()
}
