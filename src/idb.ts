// src/idb.ts — thin generic IndexedDB helpers shared by the listings cache (cache.ts)
// and the signed-image URL map (image.ts). Both live in ONE database but separate
// object stores, so store creation is coordinated here once.
export const DB_NAME = 'furmony_cache'
export const DB_VERSION = 2
export const IMG_URL_STORE = 'img_url_map'
export const LISTINGS_STORE = 'listings'
export const ORDER_KEY = 'order'
export const LEGACY_IMAGE_KEY = 'furmony_image_url_map'

export function openDb(): Promise<IDBDatabase> {
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

export async function getRecord<T>(store: string, key: string): Promise<T | undefined> {
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
export async function readAll<K, V>(store: string): Promise<Map<K, V>> {
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

export async function putMany(store: string, entries: [string, unknown][]): Promise<void> {
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
