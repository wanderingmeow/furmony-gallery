// The waterfall's scroll position: where to land on return, and how often to remember
// where the reader was. Kept free of Solid reactivity and I/O so the row-finding math is
// testable on its own; the Solid hooks that drive it live in Waterfall.tsx.
import type { AdoptListing } from '../model/types'

// How often the top visible row is written to storage. Row changes are cheap to notice
// and expensive to save, so the save waits this long behind the last one.
export const SAVE_THROTTLE_MS = 2000

/**
 * Where to restore: the index of the saved row in the current (filtered) view, or 0 when
 * the filter hid it. A row that is not in the view cannot be scrolled to, so the top is
 * the safe answer.
 */
export function findIndex(items: AdoptListing[], targetId: number): number {
  const i = items.findIndex((l) => l.adoptId === targetId)
  return i >= 0 ? i : 0
}
