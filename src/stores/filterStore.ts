// src/stores/filterStore.ts — filter state signals (tab / sort / colors / races / search).
//
// Filters live in memory (NOT the URL — no history spam) and persist to localStorage so
// they survive a refresh. Persistence is explicit: every setter writes immediately, so
// there is no hidden global effect (no module-level createEffect). Internal only —
// never touches the URL/history.
import { batch, createSignal } from 'solid-js'
import { FILTER_TABS, SORT_MODES, type FilterTab, type SortMode } from '../filter'

const FILTER_KEY = 'furmony_filter'

const [tab, setTabSignal] = createSignal<FilterTab>('all')
const [sortMode, setSortModeSignal] = createSignal<SortMode>('timeDesc')
const [selectedColors, setSelectedColorsSignal] = createSignal<Set<string>>(new Set())
const [selectedRaces, setSelectedRacesSignal] = createSignal<Set<string>>(new Set())
const [searchText, setSearchTextSignal] = createSignal('')
// Debug/tracking aid: show only listings with NO social account. Driven by the URL
// query (?nosocial=1) - deliberately NOT persisted to localStorage (it must never
// leak into normal browsing).
const [noSocialOnly, setNoSocialOnlySignal] = createSignal(false)

function persistFilters(): void {
  const f = {
    tab: tab(),
    sort: sortMode(),
    colors: [...selectedColors()],
    races: [...selectedRaces()],
    search: searchText(),
  }
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify(f))
  } catch { /* ignore */ }
}

export type FilterChangeKind = 'tab' | 'sort' | 'search' | 'colors' | 'races'
let onFilterChange: ((kind: FilterChangeKind) => void) | null = null
export function setOnFilterChange(fn: ((kind: FilterChangeKind) => void) | null): void { onFilterChange = fn }
function notify(kind: FilterChangeKind): void { onFilterChange?.(kind) }

// Explicit setters — mutate the signal AND persist in the same call (no hidden effect).
//
// Set-changing setters (tab/search/colors/races) run in one `batch()` so the store change
// + waterfall scroll-reset (notify → setScrollTop) land in a SINGLE render pass (else: new
// items at old scrollTop, then re-render on reset ≈ 2× DOM). sort stays unbatched: its
// scroll target derives from the NEW order, so notify must run after the signal.
export function setTab(v: FilterTab): void {
  batch(() => { setTabSignal(v); persistFilters(); notify('tab') })
}
export function setSortMode(v: SortMode): void { setSortModeSignal(v); persistFilters(); notify('sort') }
export function setSelectedColors(v: Set<string>): void {
  batch(() => { setSelectedColorsSignal(v); persistFilters(); notify('colors') })
}
export function setSelectedRaces(v: Set<string>): void {
  batch(() => { setSelectedRacesSignal(v); persistFilters(); notify('races') })
}
export function setSearchText(v: string): void {
  batch(() => { setSearchTextSignal(v); persistFilters(); notify('search') })
}
// no persistence — pure URL-driven debug flag
export function setNoSocialOnly(v: boolean): void { setNoSocialOnlySignal(v) }

export { tab, sortMode, selectedColors, selectedRaces, searchText, noSocialOnly }

export function loadFilters(): void {
  try {
    const raw = localStorage.getItem(FILTER_KEY)
    if (!raw) return
    const f = JSON.parse(raw) as {
      tab?: string; sort?: string; colors?: string[]; races?: string[]; search?: string
    }
    // validate tab/sort against the known vocab before applying (stale/corrupt data ignored)
    if (f.tab && FILTER_TABS.includes(f.tab as FilterTab)) setTabSignal(f.tab as FilterTab)
    if (f.sort && SORT_MODES.includes(f.sort as SortMode)) setSortModeSignal(f.sort as SortMode)
    if (Array.isArray(f.colors)) setSelectedColorsSignal(new Set(f.colors.filter(Boolean)))
    if (Array.isArray(f.races)) setSelectedRacesSignal(new Set(f.races.filter(Boolean)))
    if (typeof f.search === 'string') setSearchTextSignal(f.search)
  } catch { /* ignore */ }
}
