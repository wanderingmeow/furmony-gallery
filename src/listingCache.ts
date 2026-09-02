// src/cache.ts — IndexedDB cache layer for LISTINGS only.
//
// The signed-image URL map lives in image.ts (it's image-URL domain logic, not listing
// infra) — this module stays a clean infrastructure leaf for the adopt-list cache:
//    listings — KV table keyed by adoptId (one row per listing), plus a separate
//      `order` record holding the adoptIds in display order (the API order is meaningful).
//
// Network layer (fetchPage / fetchAllListings) lives in api.ts.
import type { AdoptListing } from './types'
import { LISTINGS_STORE, ORDER_KEY, getRecord, openDb } from './idb'

export async function loadListings(): Promise<AdoptListing[] | null> {
  try {
    const order = await getRecord<number[]>(LISTINGS_STORE, ORDER_KEY)
    // rows are keyed by numeric adoptId; the `order` record is a string key — skip it
    const byId = new Map<number, AdoptListing>()
    const db = await openDb()
    try {
      const tx = db.transaction(LISTINGS_STORE, 'readonly')
      const cur = tx.objectStore(LISTINGS_STORE).openCursor()
      await new Promise<void>((res, rej) => {
        cur.onsuccess = () => {
          const c = cur.result
          if (c) {
            if (typeof c.key === 'number') byId.set(c.key, c.value as AdoptListing)
            c.continue()
          } else {
            res()
          }
        }
        cur.onerror = () => rej(cur.error)
      })
    } finally {
      db.close()
    }
    const rows = order && order.length > 0
      ? order.map((id) => byId.get(id)).filter((l): l is AdoptListing => !!l)
      : [...byId.values()]
    return rows.length > 0 ? rows : null
  } catch {
    return null
  }
}

export async function saveListings(listings: AdoptListing[]): Promise<void> {
  try {
    const db = await openDb()
    try {
      const tx = db.transaction(LISTINGS_STORE, 'readwrite')
      const store = tx.objectStore(LISTINGS_STORE)
      store.clear() // replace-all: drop stale rows, then write every row + order
      for (const l of listings) store.put(l, l.adoptId)
      store.put(listings.map((l) => l.adoptId), ORDER_KEY)
      await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })
    } finally {
      db.close()
    }
  } catch { /* ignore */ }
}

export async function clearListings(): Promise<void> {
  try {
    const db = await openDb()
    try {
      db.transaction(LISTINGS_STORE, 'readwrite').objectStore(LISTINGS_STORE).clear()
    } finally {
      db.close()
    }
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Incremental merge: compare persisted (old) rows with freshly fetched ones, persist if
// changed. `changed` is determined by content compare directly — no hash needed.
// ---------------------------------------------------------------------------
export async function mergeListings(old: AdoptListing[], newRows: AdoptListing[]): Promise<{ updated: AdoptListing[]; changed: boolean }> {
  const oldIds = new Set(old.map((l) => l.adoptId))
  const newIds = new Set(newRows.map((l) => l.adoptId))
  let changed = oldIds.size !== newIds.size

  if (!changed) {
    const oldDict = new Map(old.map((l) => [l.adoptId, l]))
    for (const item of newRows) {
      const oldItem = oldDict.get(item.adoptId)
      if (!oldItem || JSON.stringify(oldItem) !== JSON.stringify(item)) {
        changed = true
        break
      }
    }
  }

  if (changed) {
    await saveListings(newRows)
  }

  return { updated: newRows, changed }
}
