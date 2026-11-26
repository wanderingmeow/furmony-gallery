// src/stores/filterStore.ts: filter state signals (tab / sort / colors / races / search / 主人账号
// / 出场照 / 价格区间).
//
// The filter signals live in memory, and the setters write them to localStorage on the spot,
// so a refresh keeps the filters the reader left.
import { batch, createSignal } from "solid-js";
import { type FilterTab, type SortMode } from "../model/filter";
import { sameRange, type PriceRange } from "../model/priceRange";
import { readSavedFilters } from "../model/savedFilters";

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
const [debutOnly, setDebutOnlySignal] = createSignal(false);
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
    debutOnly: debutOnly(),
    price: priceRange(),
  };
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify(f));
  } catch {
    /* ignore */
  }
}

export type FilterChangeKind =
  | "tab"
  | "sort"
  | "search"
  | "colors"
  | "races"
  | "socialOnly"
  | "debutOnly"
  | "priceRange";
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
/** The order an address asked for, for this visit only. Nothing is written down: an order someone
 *  reached by tapping a notification does not get to replace the one the reader left.
 */
export function linkSort(v: SortMode): void {
  setSortModeSignal(v);
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
// The debut-picture switch. `debutFilterOn` in the derived store decides whether it may run.
export function setDebutOnly(v: boolean): void {
  batch(() => {
    setDebutOnlySignal(v);
    persistFilters();
    notify("debutOnly");
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
  debutOnly,
  priceRange,
};

export function loadFilters(): void {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (!raw) return;
    const saved = readSavedFilters(raw);
    batch(() => {
      if (saved.tab) setTabSignal(saved.tab);
      if (saved.sort) setSortModeSignal(saved.sort);
      setSelectedColorsSignal(new Set(saved.colors));
      setSelectedRacesSignal(new Set(saved.races));
      if (saved.search !== undefined) setSearchTextSignal(saved.search);
      setSocialOnlySignal(saved.socialOnly);
      setDebutOnlySignal(saved.debutOnly);
      if (saved.price) setPriceRangeSignal(saved.price);
    });
  } catch {
    // A save this build cannot read is no filter at all.
  }
}
