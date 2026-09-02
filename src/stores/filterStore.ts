// src/stores/filterStore.ts — filter state signals (tab / sort / colors / races / search).
//
// Filters live in memory (NOT the URL — no history spam) and persist to localStorage so
// they survive a refresh. Persistence is explicit: every setter writes immediately, so
// there is no hidden global effect (no module-level createEffect). Internal only —
// never touches the URL/history.
import { createSignal } from 'solid-js'
import { FILTER_TABS, SORT_MODES, type FilterTab, type SortMode } from '../filter'

const FILTER_KEY = 'furmony_filter'

const [tab, setTabSignal] = createSignal<FilterTab>('all')
const [sortMode, setSortModeSignal] = createSignal<SortMode>('timeDesc')
const [selectedColors, setSelectedColorsSignal] = createSignal<Set<string>>(new Set())
const [selectedRaces, setSelectedRacesSignal] = createSignal<Set<string>>(new Set())
const [searchText, setSearchTextSignal] = createSignal('')

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

// Explicit setters — mutate the signal AND persist in the same call (no hidden effect).
export function setTab(v: FilterTab): void { setTabSignal(v); persistFilters() }
export function setSortMode(v: SortMode): void { setSortModeSignal(v); persistFilters() }
export function setSelectedColors(v: Set<string>): void { setSelectedColorsSignal(v); persistFilters() }
export function setSelectedRaces(v: Set<string>): void { setSelectedRacesSignal(v); persistFilters() }
export function setSearchText(v: string): void { setSearchTextSignal(v); persistFilters() }

export { tab, sortMode, selectedColors, selectedRaces, searchText }

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
