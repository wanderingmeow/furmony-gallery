// src/data/idb.ts - the IndexedDB helpers for the two local caches: listings (listingCache.ts)
// and signed image URLs (image.ts).
//
// Both stores are in one database, so adding a store means raising DB_VERSION here and
// creating it in openDb.
export const DB_NAME = 'furmony_cache'
export const DB_VERSION = 2
export const IMG_URL_STORE = 'img_url_map'
export const LISTINGS_STORE = 'listings'
export const ORDER_KEY = 'order'

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

// The promise waits for oncomplete, so a write is durable by the time it resolves. A request
// that fails aborts the transaction, and that rejects the promise.
async function withStore(
  store: string,
  mode: IDBTransactionMode,
  run: (obj: IDBObjectStore) => void,
): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(store, mode)
    run(tx.objectStore(store))
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res()
      tx.onerror = () => rej(tx.error)
      tx.onabort = () => rej(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function readAll<K, V>(store: string): Promise<Map<K, V>> {
  const out = new Map<K, V>()
  await withStore(store, 'readonly', (obj) => {
    const cur = obj.openCursor()
    cur.onsuccess = () => {
      const c = cur.result
      if (c) {
        out.set(c.key as K, c.value as V)
        c.continue()
      }
    }
  })
  return out
}

export function putMany(store: string, entries: [string | number, unknown][]): Promise<void> {
  return withStore(store, 'readwrite', (obj) => {
    for (const [k, v] of entries) obj.put(v, k)
  })
}

// The clear and the writes are one transaction, so a read at the same time returns either the
// old contents or the new ones, never an empty store.
export function replaceAll(store: string, entries: [string | number, unknown][]): Promise<void> {
  return withStore(store, 'readwrite', (obj) => {
    obj.clear()
    for (const [k, v] of entries) obj.put(v, k)
  })
}

export function clearStore(store: string): Promise<void> {
  return withStore(store, 'readwrite', (obj) => { obj.clear() })
}
