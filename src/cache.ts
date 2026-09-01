// src/cache.ts — IndexedDB cache layer.
//
// Two caches live here, both in IndexedDB (quota effectively unlimited) so localStorage
// stays well under its ~5MB limit:
//   1. img_url_map — plain KV: key = image path, value = first-seen signed URL, for
//      browser HTTP-cache hits across refreshes. Reads are synchronous through an
//      in-memory Map; writes are debounced async and only touch dirty (newly-seen) keys.
//   2. listings     — KV table keyed by adoptId (one row per listing), plus a separate
//      `order` record holding the adoptIds in display order (the API order is meaningful).
//
// Network layer (fetchPage / fetchAllListings) lives in api.ts.

import type { AdoptListing } from './types'

const DB_NAME = 'furmony_cache'
const DB_VERSION = 2
const IMG_URL_STORE = 'img_url_map'
const LISTINGS_STORE = 'listings'
const ORDER_KEY = 'order'
const LEGACY_IMAGE_KEY = 'furmony_image_url_map'

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(LISTINGS_STORE)) db.createObjectStore(LISTINGS_STORE)
      if (!db.objectStoreNames.contains(IMG_URL_STORE)) db.createObjectStore(IMG_URL_STORE)
    }
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

async function getRecord<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDb()
  try {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).get(key)
    const rec = await new Promise<T | undefined>((res, rej) => {
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    return rec
  } finally {
    db.close()
  }
}

// Read every entry of a KV store into a Map (key -> value).
async function readAll<K, V>(store: string): Promise<Map<K, V>> {
  const out = new Map<K, V>()
  const db = await openDb()
  try {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).openCursor()
    await new Promise<void>((res, rej) => {
      req.onsuccess = () => {
        const cur = req.result
        if (cur) {
          out.set(cur.key as K, cur.value as V)
          cur.continue()
        } else {
          res()
        }
      }
      req.onerror = () => rej(req.error)
    })
  } finally {
    db.close()
  }
  return out
}

async function putMany(store: string, entries: [string, unknown][]): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(store, 'readwrite')
    const obj = tx.objectStore(store)
    for (const [k, v] of entries) obj.put(v, k)
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })
  } finally {
    db.close()
  }
}

// ---------------------------------------------------------------------------
// Signed-image URL map (img_url_map KV)
// ---------------------------------------------------------------------------
let imageUrlMap: Map<string, string> | null = null
let recentRaw = new Map<string, string>() // path -> freshest signed URL (for error retry)
let dirtyPaths: Set<string> | null = null // paths added since last persist
let persistTimer: ReturnType<typeof setTimeout> | null = null

function loadMap(): Map<string, string> {
  if (!imageUrlMap) imageUrlMap = new Map()
  return imageUrlMap
}

async function persistNow(): Promise<void> {
  const dirty = dirtyPaths
  dirtyPaths = null
  if (!dirty || dirty.size === 0) return
  try {
    const map = loadMap()
    const entries: [string, string][] = []
    for (const path of dirty) {
      const url = map.get(path)
      if (url) entries.push([path, url])
    }
    await putMany(IMG_URL_STORE, entries)
  } catch { /* IndexedDB unavailable */ }
}

function persist() {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => { persistNow() }, 1000)
}

// Load persisted KV entries into memory. DB entries WIN over any session-fresh writes:
// they're the remembered (cross-session cacheable) URLs — that's the whole point.
export async function initImageUrlMap(): Promise<void> {
  loadMap()
  try {
    const dbMap = await readAll<string, string>(IMG_URL_STORE)
    for (const [path, url] of dbMap) imageUrlMap!.set(path, url)
  } catch { /* IndexedDB unavailable — memory-only */ }

  // migrate: drop the old localStorage copy so listings/session writes stay under quota
  try { localStorage.removeItem(LEGACY_IMAGE_KEY) } catch { /* ignore */ }
}

// Returns a stable URL for `raw`. Only URLs with a `?` (signed) are mapped — no-query
// URLs are returned as-is and bypass the map entirely.
export function stableImageUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw
  const q = raw.indexOf('?')
  if (q === -1) return raw
  const path = raw.slice(0, q)
  recentRaw.set(path, raw)
  const map = loadMap()
  const memo = map.get(path)
  if (memo) return memo
  map.set(path, raw)
  if (!dirtyPaths) dirtyPaths = new Set()
  dirtyPaths.add(path)
  persist()
  return raw
}

// Self-healing image error handler: on a failed load, retry with the freshest signed URL
// seen for that path (max 2 retries), in case the remembered URL went stale.
export function onImageError(e: Event): void {
  const img = e.target as HTMLImageElement
  if (!img) return
  const tries = Number(img.dataset.retry || 0)
  if (tries >= 2) return
  const src = img.currentSrc || img.src
  const path = src.split('?')[0]
  const fresh = recentRaw.get(path)
  img.dataset.retry = String(tries + 1)
  img.src = fresh && fresh !== src ? fresh : src
}

// Flush pending image-map writes immediately (best-effort for beforeunload — IndexedDB
// writes are async, so this may not complete on an immediate close, but the debounced
// write during normal use keeps the map durable).
export function flushImageUrlMap(): Promise<void> {
  if (!imageUrlMap || !persistTimer) return Promise.resolve()
  clearTimeout(persistTimer)
  persistTimer = null
  return persistNow()
}

// ---------------------------------------------------------------------------
// Listings cache (KV table keyed by adoptId + `order` record for display order)
// ---------------------------------------------------------------------------
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
