// src/stores/filterStore.ts: filter state signals (tab / sort / colors / races / search).
//
// The filter signals live in memory, and the setters write them to localStorage on the spot,
// so a refresh keeps the filters the reader left.
import { batch, createSignal } from 'solid-js'
import { FILTER_TABS, SORT_MODES, type FilterTab, type SortMode } from '../model/filter'
import { hasUncommittedText } from '../model/composing'

const FILTER_KEY = 'furmony_filter'

const [tab, setTabSignal] = createSignal<FilterTab>('all')
const [sortMode, setSortModeSignal] = createSignal<SortMode>('timeDesc')
const [selectedColors, setSelectedColorsSignal] = createSignal<Set<string>>(new Set())
const [selectedRaces, setSelectedRacesSignal] = createSignal<Set<string>>(new Set())
const [searchText, setSearchTextSignal] = createSignal('')
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

// Each setter runs in one `batch()`, so the store change and the waterfall scroll reset
// (notify → setScrollTop) share a single render pass.
export function setTab(v: FilterTab): void {
  batch(() => { setTabSignal(v); persistFilters(); notify('tab') })
}
export function setSortMode(v: SortMode): void {
  batch(() => { setSortModeSignal(v); persistFilters(); notify('sort') })
}
export function setSelectedColors(v: Set<string>): void {
  batch(() => { setSelectedColorsSignal(v); persistFilters(); notify('colors') })
}
export function setSelectedRaces(v: Set<string>): void {
  batch(() => { setSelectedRacesSignal(v); persistFilters(); notify('races') })
}
export function setSearchText(v: string): void {
  batch(() => { setSearchTextSignal(v); persistFilters(); notify('search') })
}
// no persistence: the URL sets this flag
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
    // A query stored before the input gate existed can still hold syllables nobody
    // committed. That is not a question, so `loadFilters` ignores it.
    if (typeof f.search === 'string' && !hasUncommittedText(f.search)) setSearchTextSignal(f.search)
  } catch { /* ignore */ }
}
