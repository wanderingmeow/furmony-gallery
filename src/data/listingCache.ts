// src/data/listingCache.ts - the IndexedDB cache for listings.
//
// The `listings` store holds one row per adoptId, plus a single `order` record with the
// adoptIds in display order: the order that the API sends is the order on screen.
//
// Opening the database and running transactions lives in idb.ts. Fetching from the API lives
// in api.ts.
import type { AdoptListing } from '../model/types'
import { urlPath } from './image'
import { LISTINGS_STORE, ORDER_KEY, clearStore, readAll, replaceAll } from './idb'

// Rows and the `order` record share one store, so a read of the store returns both. A row is
// keyed by a number and holds an AdoptListing; `order` is the one string key and holds ids.
export async function loadListings(): Promise<AdoptListing[] | null> {
  try {
    const all = await readAll<number | string, AdoptListing | number[]>(LISTINGS_STORE)
    const byId = new Map<number, AdoptListing>()
    for (const [key, value] of all) {
      if (typeof key === 'number' && !Array.isArray(value)) byId.set(key, value)
    }
    const order = all.get(ORDER_KEY)
    const rows = Array.isArray(order) && order.length > 0
      ? order.map((id) => byId.get(id)).filter((l): l is AdoptListing => !!l)
      : [...byId.values()]
    return rows.length > 0 ? rows : null
  } catch {
    return null
  }
}

export async function saveListings(listings: AdoptListing[]): Promise<void> {
  try {
    const entries: [string | number, unknown][] = listings.map((l) => [l.adoptId, l])
    entries.push([ORDER_KEY, listings.map((l) => l.adoptId)])
    await replaceAll(LISTINGS_STORE, entries)
  } catch { /* ignore */ }
}

export async function clearListings(): Promise<void> {
  try {
    await clearStore(LISTINGS_STORE)
  } catch { /* ignore */ }
}

// The waterfall keys each card by its listing object, so a row with the same content has to be
// handed back as the same object: a new object means a new card and a cover that decodes again.

// What the reader would see. Signed URLs are compared by path, so a new signature is the same
// image. Keys are sorted, because the order of the fields in the JSON is not something a reader
// can see. The order inside a list is visible: api.ts sorts the two lists that the API returns
// unordered, and a third one would rebuild every card.
function fingerprint(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(urlPath(value))
  if (Array.isArray(value)) return `[${value.map(fingerprint).join(',')}]`
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>
    return `{${Object.keys(row).sort()
      .map((k) => `${JSON.stringify(k)}:${fingerprint(row[k])}`).join(',')}}`
  }
  return value === undefined ? 'null' : JSON.stringify(value)
}

export async function mergeListings(old: AdoptListing[], newRows: AdoptListing[]): Promise<{ updated: AdoptListing[]; changed: boolean }> {
  const byId = new Map(old.map((l) => [l.adoptId, { row: l, print: fingerprint(l) }]))
  const updated = newRows.map((item) => {
    const prior = byId.get(item.adoptId)
    return prior && prior.print === fingerprint(item) ? prior.row : item
  })
  // A row with the same content kept its old object, so a new object here is a change.
  const changed = updated.length !== old.length || updated.some((l, i) => l !== old[i])

  if (changed) {
    await saveListings(updated)
  }

  return { updated, changed }
}
