// src/data/image.ts - signed-image URL resolution + persistence.
//
// Reads are synchronous through an in-memory Map; writes are debounced async and only touch
// dirty (newly-seen) keys. Persistence lives in the `img_url_map` IndexedDB store via the
// generic idb helpers.
import { IMG_URL_STORE, putMany, readAll } from './idb'

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
// they're the remembered (cross-session cacheable) URLs - that's the whole point.
export async function initImageUrlMap(): Promise<void> {
  loadMap()
  try {
    const dbMap = await readAll<string, string>(IMG_URL_STORE)
    for (const [path, url] of dbMap) imageUrlMap!.set(path, url)
  } catch { /* IndexedDB unavailable - memory-only */ }
}

/**
 * The URL without its signature. The API signs the same path again on every request, so the
 * path is what identifies an image across visits. Text that is not an http(s) URL is returned
 * unchanged, question mark and all.
 */
export function urlPath(raw: string): string {
  if (!/^https?:\/\//i.test(raw)) return raw
  const q = raw.indexOf('?')
  return q === -1 ? raw : raw.slice(0, q)
}

// The browser's HTTP cache keys on the whole URL, so this returns the first URL seen for that
// path and keeps it across visits: the cover then loads from cache.
export function stableImageUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw
  const path = urlPath(raw)
  if (path === raw) return raw
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
  const path = urlPath(src)
  const fresh = recentRaw.get(path)
  img.dataset.retry = String(tries + 1)
  img.src = fresh && fresh !== src ? fresh : src
}

// Flush pending image-map writes immediately (best-effort for beforeunload - IndexedDB
// writes are async, so this may not complete on an immediate close, but the debounced
// write during normal use keeps the map durable).
/**
 * Flush the map when the page goes away. Both events are registered, because mobile Safari
 * fires `pagehide` and often skips `beforeunload`. Only the first one writes: the flush is
 * best-effort, and starting it twice adds nothing but a second IndexedDB write.
 */
export function flushUrlMapOnExit(): void {
  let flushed = false
  const once = (): void => {
    if (flushed) return
    flushed = true
    void flushImageUrlMap()
  }
  window.addEventListener('beforeunload', once)
  window.addEventListener('pagehide', once)
}

export function flushImageUrlMap(): Promise<void> {
  if (!imageUrlMap || !persistTimer) return Promise.resolve()
  clearTimeout(persistTimer)
  persistTimer = null
  return persistNow()
}
