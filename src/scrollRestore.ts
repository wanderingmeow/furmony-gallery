// src/scrollRestore.ts — pure logic for restoring the waterfall's scroll position.
//
// Kept free of Solid reactivity and I/O so the row-finding math is testable in isolation.
// The Solid hooks that drive restore/persistence live in Waterfall.tsx and call this.
import type { AdoptListing } from './types'

// Index of the saved top-visible row to restore to. Exact adoptId match if the row is in
// the current (filtered) view; otherwise 0 (top) — a filtered-out row no longer exists in
// the view, so landing at the top is the safe fallback.
export function findIndex(items: AdoptListing[], targetId: number): number {
  const i = items.findIndex((l) => l.adoptId === targetId)
  return i >= 0 ? i : 0
}
