// Parsing and lookup for the related row. No solid import, so a test can call these
// directly.
//
// The neighbour table comes from embedding/src/25_export_related.py and ships as
// public/related.json. It stores adoptIds only: signed image URLs expire, and the app
// re-derives a URL with stableImageUrl() anyway, so ids stay small and never go stale.
// The listing objects themselves come from the current listings() at render time.
import type { AdoptListing } from './types'

export interface RelatedTable {
  /** How many neighbours each row holds. A file without this number is not our file, so
   * parse treats it as malformed and the row disappears. */
  topN: number
  neighbors: Map<number, number[]>
}

/** Before the first fetch lands, and after a malformed one. */
export const EMPTY_TABLE: RelatedTable = { topN: 0, neighbors: new Map() }

/** Below this many live neighbours the strip looks broken rather than empty, so we hide it. */
export const MIN_RELATED = 3

/** Parse `public/related.json`. Anything malformed degrades to an empty table → no strip. */
export function parseRelated(data: unknown): RelatedTable {
  if (typeof data !== 'object' || data === null) return EMPTY_TABLE
  const { topN, neighbors } = data as { topN?: unknown; neighbors?: unknown }
  if (typeof topN !== 'number' || typeof neighbors !== 'object' || neighbors === null) {
    return EMPTY_TABLE
  }
  const rows = new Map<number, number[]>()
  for (const [key, value] of Object.entries(neighbors as Record<string, unknown>)) {
    const adoptId = Number(key)
    if (!Number.isInteger(adoptId)) continue
    // A row that names its own id means the generator leaked. This is the one place that
    // guard lives, so no caller has to ask "is this the card I am already on?".
    const ids = (Array.isArray(value) ? value : [])
      .filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n !== adoptId)
    if (ids.length > 0) rows.set(adoptId, ids)
  }
  return { topN, neighbors: rows }
}

/**
 * Neighbours of one id, in the generator's order. Read-only, because the array is the
 * stored row rather than a copy.
 */
export function relatedIds(table: RelatedTable, adoptId: number): readonly number[] {
  return table.neighbors.get(adoptId) ?? []
}

/**
 * Keep the neighbours that are still listed, in table order. A neighbour can be missing:
 * upstream deleted it, or the network refresh has not merged while the first frame
 * renders. The ranking is the whole content, so this filters and never re-sorts.
 */
export function resolveRelated(ids: readonly number[], listings: AdoptListing[]): AdoptListing[] {
  const byId = new Map(listings.map((l) => [l.adoptId, l]))
  const out: AdoptListing[] = []
  for (const id of ids) {
    const found = byId.get(id)
    if (found) out.push(found)
  }
  return out
}
