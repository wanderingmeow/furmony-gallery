// src/model/savedFilters.ts - what a saved filter blob is allowed to say.
import { hasUncommittedText } from "./composing";
import {
  FILTER_TABS,
  SORT_MODES,
  type FilterTab,
  type SortMode,
} from "./filter";
import { isKnownColor, isKnownRaceName } from "../i18n/glossary";

/** The filters the saved blob vouches for. A part it cannot vouch for is absent rather than
 *  wrong, so the page keeps its own starting value for it. */
export interface SavedFilters {
  tab?: FilterTab;
  sort?: SortMode;
  colors: string[];
  races: string[];
  search?: string;
  socialOnly: boolean;
  price?: [number, number];
}

/** One of the names the page knows. A stale or corrupt name is ignored: it would ask for a tab
 *  or an order that no longer exists. */
function oneOf<T extends string>(
  known: readonly T[],
  value: unknown,
): T | undefined {
  return known.includes(value as T) ? (value as T) : undefined;
}

/** Names the shelf still sends. A pick is stored as the name the shelf wrote, so a filter holds
 *  across a change of language; a name that no longer arrives is dropped, because it would
 *  filter the list down with no chip showing to clear it. */
function knownNames(keep: (name: string) => boolean, value: unknown): string[] {
  return Array.isArray(value) ? value.filter(keep) : [];
}

/** A query only if it is a question: a saved string can still hold syllables nobody committed. */
function keptQuery(value: unknown): string | undefined {
  return typeof value === "string" && !hasUncommittedText(value)
    ? value
    : undefined;
}

/** Two finite numbers in order. A range missing either, or reversed, would hide every row. */
function orderedPair(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [low, high] = value as [unknown, unknown];
  if (typeof low !== "number" || typeof high !== "number") return undefined;
  if (!Number.isFinite(low) || !Number.isFinite(high) || low > high)
    return undefined;
  return [low, high];
}

/** Read the blob. It throws with the JSON, so a save that is not JSON leaves the page on its
 *  own starting values rather than on half of a read. */
export function readSavedFilters(raw: string): SavedFilters {
  const f: Record<string, unknown> = JSON.parse(raw) ?? {};
  return {
    tab: oneOf(FILTER_TABS, f.tab),
    sort: oneOf(SORT_MODES, f.sort),
    colors: knownNames(isKnownColor, f.colors),
    races: knownNames(isKnownRaceName, f.races),
    search: keptQuery(f.search),
    socialOnly: f.socialOnly === true,
    price: orderedPair(f.price),
  };
}
