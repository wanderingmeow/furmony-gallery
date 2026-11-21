// src/model/statistics.ts - pure statistics derivations for the stats page.
// Mirrors the Swift StatisticsView data helpers (price bins, color/race counts,
// monthly price stats, monthly counts). No DOM, no network - testable.

import { tr } from "../i18n";
import type { AdoptListing } from "./types";
import {
  colorDisplay,
  colorNames,
  countedRaceDisplay,
  displayPrice,
  isLocked,
  publishDate,
} from "./domain";

export type LockFilter = "all" | "locked" | "unlocked";
export const LOCK_FILTERS: LockFilter[] = ["all", "locked", "unlocked"];
const LOCK_KEY = {
  all: "tab.all",
  locked: "detail.locked",
  unlocked: "detail.unlocked",
} as const;

export const lockLabel = (mode: LockFilter): string => tr(LOCK_KEY[mode]);

// locked = isLocked() (isLock === 2) - matches Swift isLocked and the app semantics.
export function filterByLock(
  listings: AdoptListing[],
  mode: LockFilter,
): AdoptListing[] {
  switch (mode) {
    case "locked":
      return listings.filter(isLocked);
    case "unlocked":
      return listings.filter((l) => !isLocked(l));
    default:
      return listings;
  }
}

export interface Bin {
  label: string;
  count: number;
  low: number;
  high: number;
}
export interface StatEntry {
  name: string;
  count: number;
}
export interface MonthlyPrice {
  label: string;
  avg: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
  median: number;
}
export interface MonthlyCount {
  label: string;
  count: number;
}

// ---- price ----
export function medianPrice(prices: number[]): number {
  const sorted = prices.slice().sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  if (n % 2 === 0) return (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  return sorted[(n - 1) / 2];
}

/** The width of one bar in the panel's price grid. Its histogram and the slider's steps sit on
 *  this one grid, so a thumb over a bar points at that bar. */
export const PRICE_BUCKET = 1000;

/** The width of one bar in the stats page's price chart. That chart keeps its own, wider grid. */
export const STATS_PRICE_BUCKET = 2000;

/**
 * Bars of `bucket` yuan each. A price that lands on a boundary belongs to the bar that starts
 * there, so no price falls between two bars. Every bar is `bucket` wide, and the last one always
 * holds the highest price. A label is the bar's two ends in thousands.
 *
 * `extent` draws over a grid decided elsewhere: it sets the first and the last edge, and prices
 * outside it join no bar. The panel hands in the tab's extent, so a bar keeps its place while the
 * picks change what sits in it.
 *
 * With no `extent` the grid is cut to the prices given, and prices that are all one value draw
 * nothing: one bar would cover them all.
 */
export function priceBins(
  prices: number[],
  bucket = PRICE_BUCKET,
  extent?: [number, number] | null,
): Bin[] {
  if (prices.length === 0) return [];
  const start = extent
    ? extent[0]
    : Math.floor(Math.min(...prices) / bucket) * bucket;
  const max = Math.max(...prices);
  const end = extent ? extent[1] : (Math.floor(max / bucket) + 1) * bucket;
  if (start >= end) return [];
  if (!extent && Math.min(...prices) >= max) return [];
  const bins: Bin[] = [];
  let low = start;
  while (low < end) {
    const high = low + bucket;
    const count = prices.filter((p) => p >= low && p < high).length;
    bins.push({
      label: `${Math.round(low / 1000)}-${Math.round(high / 1000)}`,
      count,
      low,
      high,
    });
    low = high;
  }
  return bins;
}

// Bin EDGES (boundaries) for the histogram - the bins are contiguous [low, high),
// so the edges are [bins[0].low] + each bin's high.
export function priceEdges(bins: Bin[]): number[] {
  if (bins.length === 0) return [];
  const edges = [bins[0].low];
  for (const b of bins) edges.push(b.high);
  return edges;
}

/** Which end gets an empty bar: above the top, below the bottom, both, or neither. */
export type EmptyBarSide = "none" | "above" | "below" | "both";

/**
 * The bars with one empty bar at the end the band sits past.
 *
 * A band left over from another tab can reach past every price this tab holds. Snapped back onto
 * the grid, it would cover the last bar of real listings and look like a choice the reader made.
 * The empty bar gives that band somewhere else to sit.
 */
export function withEmptyBar(
  bins: Bin[],
  bucket: number,
  side: EmptyBarSide,
): Bin[] {
  if (bins.length === 0 || side === "none") return bins;
  const bar = (low: number): Bin => ({
    label: `${Math.round(low / 1000)}-${Math.round((low + bucket) / 1000)}`,
    count: 0,
    low,
    high: low + bucket,
  });
  const below = bar(bins[0].low - bucket);
  const above = bar(bins[bins.length - 1].high);
  if (side === "both") return [below, ...bins, above];
  return side === "above" ? [...bins, above] : [below, ...bins];
}

// ---- color / race (sorted desc like Swift) ----
// Shared decision: turn a tally Map into sorted StatEntry[] (desc). The counting
// loops stay local (color is multi-key per listing, race is single-key).
function toSortedEntries(counts: Map<string, number>): StatEntry[] {
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function colorCounts(listings: AdoptListing[]): StatEntry[] {
  const counts = new Map<string, number>();
  for (const l of listings) {
    // The count is keyed by the word on screen. A chart reads these names straight out, and
    // the language is one of the things the memo watches, so a new language redraws it.
    for (const name of colorNames(l)) {
      const shown = colorDisplay(name);
      counts.set(shown, (counts.get(shown) ?? 0) + 1);
    }
  }
  return toSortedEntries(counts);
}

export function raceCounts(listings: AdoptListing[]): StatEntry[] {
  const counts = new Map<string, number>();
  for (const l of listings) {
    const name = countedRaceDisplay(l);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return toSortedEntries(counts);
}

// ---- monthly ----
// The month key "24/03" becomes the words a chart axis shows: 24年3月 in Chinese, Mar 2024
// in English.
export function fmtMonth(label: string): string {
  const [yy, mm] = label.split("/");
  return tr("stats.monthLabel", 2000 + Number(yy), parseInt(mm, 10));
}

// Month key "YY/MM" (year % 100, zero-padded) - lexicographic sort == chronological.
function monthKey(createTime: string): string {
  const d = publishDate({ createTime } as AdoptListing);
  if (d) {
    const yy = String(d.getFullYear() % 100).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yy}/${mm}`;
  }
  // fallback (mirrors Swift dropFirst(2)/dropFirst(5)): "25" + "/" + "06"
  return createTime.slice(2, 4) + "/" + createTime.slice(5, 7);
}

function percentile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0];
  const rank = p * (n - 1);
  const lower = Math.floor(rank);
  const frac = rank - lower;
  const upper = Math.min(lower + 1, n - 1);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * frac;
}

// Group listings into month-keyed buckets, sorted ascending (lexicographic order
// == chronological). `keyOf` returns the month key or null to skip; `valueOf`
// picks the value collected per bucket. Shared by the two monthly derivations.
function groupByMonth<T, V>(
  items: T[],
  keyOf: (item: T) => string | null,
  valueOf: (item: T) => V,
): [string, V[]][] {
  const groups = new Map<string, V[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (key == null) continue;
    const arr = groups.get(key) ?? [];
    arr.push(valueOf(item));
    groups.set(key, arr);
  }
  return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

export function monthlyPriceStats(listings: AdoptListing[]): MonthlyPrice[] {
  return groupByMonth(
    listings,
    (l) =>
      displayPrice(l) > 0 && l.createTime ? monthKey(l.createTime) : null,
    displayPrice,
  ).map(([label, prices]) => {
    const sorted = prices.slice().sort((a, b) => a - b);
    const sum = prices.reduce((acc, p) => acc + p, 0);
    return {
      label,
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      p25: percentile(sorted, 0.25),
      p75: percentile(sorted, 0.75),
      median: percentile(sorted, 0.5),
      avg: sum / prices.length,
    };
  });
}

export function monthlyCounts(listings: AdoptListing[]): MonthlyCount[] {
  return groupByMonth(
    listings,
    (l) => (l.createTime ? monthKey(l.createTime) : null),
    (l) => l,
  ).map(([label, rows]) => ({ label, count: rows.length }));
}
