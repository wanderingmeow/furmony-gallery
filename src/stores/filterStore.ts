// src/stores/filterStore.ts: filter state signals (tab / sort / colors / races / search / 主人账号
// / 价格区间).
//
// The filter signals live in memory, and the setters write them to localStorage on the spot,
// so a refresh keeps the filters the reader left.
import { batch, createSignal } from "solid-js";
import {
  FILTER_TABS,
  SORT_MODES,
  type FilterTab,
  type SortMode,
} from "../model/filter";
import { sameRange, type PriceRange } from "../model/priceRange";
import { hasUncommittedText } from "../model/composing";
import { isKnownColor, isKnownRaceName } from "../i18n/glossary";

const FILTER_KEY = "furmony_filter";

const [tab, setTabSignal] = createSignal<FilterTab>("all");
/** The order the page starts in. */
export const DEFAULT_SORT: SortMode = "timeDesc";
const [sortMode, setSortModeSignal] = createSignal<SortMode>(DEFAULT_SORT);
const [selectedColors, setSelectedColorsSignal] = createSignal<Set<string>>(
  new Set(),
);
const [selectedRaces, setSelectedRacesSignal] = createSignal<Set<string>>(
  new Set(),
);
const [searchText, setSearchTextSignal] = createSignal("");
const [socialOnly, setSocialOnlySignal] = createSignal(false);
// 价格区间. null is the whole list: the reader has not narrowed the price.
const [priceRange, setPriceRangeSignal] = createSignal<PriceRange | null>(
  null,
  {
    equals: sameRange,
  },
);

function persistFilters(): void {
  const f = {
    tab: tab(),
    sort: sortMode(),
    colors: [...selectedColors()],
    races: [...selectedRaces()],
    search: searchText(),
    socialOnly: socialOnly(),
    price: priceRange(),
  };
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify(f));
  } catch {
    /* ignore */
  }
}

export type FilterChangeKind =
  "tab" | "sort" | "search" | "colors" | "races" | "socialOnly" | "priceRange";
/** The page hands the store what a filter change should do. The store never touches the document,
 *  so the waterfall registers its own scroll reset here. */
let onFilterChange: ((kind: FilterChangeKind) => void) | null = null;
export function setOnFilterChange(
  fn: ((kind: FilterChangeKind) => void) | null,
): void {
  onFilterChange = fn;
}
function notify(kind: FilterChangeKind): void {
  onFilterChange?.(kind);
}

// Each setter runs in one `batch()`, so the store change and the waterfall scroll reset
// (notify → setScrollTop) share a single render pass.
let bandHeld = false;
export function setTab(v: FilterTab): void {
  batch(() => {
    setTabSignal(v);
    persistFilters();
    notify("tab");
  });
}
export function setSortMode(v: SortMode): void {
  batch(() => {
    setSortModeSignal(v);
    persistFilters();
    notify("sort");
  });
}
export function setSelectedColors(v: Set<string>): void {
  batch(() => {
    setSelectedColorsSignal(v);
    persistFilters();
    notify("colors");
  });
}
export function setSelectedRaces(v: Set<string>): void {
  batch(() => {
    setSelectedRacesSignal(v);
    persistFilters();
    notify("races");
  });
}
export function setSearchText(v: string): void {
  // The same query is not a change, so it does not reset the list's scroll. Closing the box writes
  // the empty string whether or not there was a query, and an empty box that reports a change would
  // throw the reader back to the top of a list that stayed the same.
  if (searchText() === v) return;
  batch(() => {
    setSearchTextSignal(v);
    persistFilters();
    notify("search");
  });
}
// The owner-account switch. `socialFilterOn` in the derived store decides whether it may run.
export function setSocialOnly(v: boolean): void {
  batch(() => {
    setSocialOnlySignal(v);
    persistFilters();
    notify("socialOnly");
  });
}
// The band compares by what it keeps, so a drag's repeated pair is neither a recompute nor a
// reason to persist and jump the list back to the top.
export function setPriceRange(v: PriceRange | null): void {
  if (sameRange(priceRange(), v)) return;
  batch(() => {
    setPriceRangeSignal(v);
    // A gesture in progress writes the pair it leaves behind, not the ones it passed through.
    if (!bandHeld) persistFilters();
    notify("priceRange");
  });
}

/** A drag has begun: the list follows the finger, the stored pair waits. */
export function holdPriceBand(): void {
  bandHeld = true;
}

/** The drag let go, or its control went away: this is the pair worth keeping. */
export function releasePriceBand(): void {
  if (!bandHeld) return;
  bandHeld = false;
  persistFilters();
}

export {
  tab,
  sortMode,
  selectedColors,
  selectedRaces,
  searchText,
  socialOnly,
  priceRange,
};

export function loadFilters(): void {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (!raw) return;
    const f = JSON.parse(raw) as {
      tab?: string;
      sort?: string;
      colors?: string[];
      races?: string[];
      search?: string;
      socialOnly?: boolean;
      price?: number[];
    };
    // validate tab/sort against the known vocab before applying (stale/corrupt data ignored)
    if (f.tab && FILTER_TABS.includes(f.tab as FilterTab))
      setTabSignal(f.tab as FilterTab);
    if (f.sort && SORT_MODES.includes(f.sort as SortMode))
      setSortModeSignal(f.sort as SortMode);
    // A pick is stored as the name the shelf wrote, so a filter holds across a change of
    // language. A name the shelf no longer sends is dropped with the rest of the stale data: it
    // would filter the list down with no chip showing to clear.
    if (Array.isArray(f.colors))
      setSelectedColorsSignal(new Set(f.colors.filter(isKnownColor)));
    if (Array.isArray(f.races))
      setSelectedRacesSignal(new Set(f.races.filter(isKnownRaceName)));
    // A query stored before the input gate existed can still hold syllables nobody
    // committed. That is not a question, so `loadFilters` ignores it.
    if (typeof f.search === "string" && !hasUncommittedText(f.search))
      setSearchTextSignal(f.search);
    setSocialOnlySignal(f.socialOnly === true);
    // Two finite numbers in order, or nothing: a stored range that lost a number would hide
    // every row.
    const p = f.price;
    if (
      Array.isArray(p) &&
      p.length === 2 &&
      p.every((n) => Number.isFinite(n)) &&
      p[0] <= p[1]
    ) {
      setPriceRangeSignal([p[0], p[1]]);
    }
  } catch {
    /* ignore */
  }
}
