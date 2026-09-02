// src/image.ts — signed-image URL resolution + persistence.
//
// Image-URL domain service: maps an image path to its first-seen signed URL so the browser
// HTTP cache hits across refreshes. Reads are synchronous through an in-memory Map; writes
// are debounced async and only touch dirty (newly-seen) keys. Persistence lives in the
// `img_url_map` IndexedDB store via the generic idb helpers.
//
// This module is imported by the domain helpers (domain.ts) and components — NOT the
// listings cache. That keeps the pure domain layer off the infrastructure cache layer:
// listingCache.ts stays a leaf for listings only.
import { IMG_URL_STORE, LEGACY_IMAGE_KEY, putMany, readAll } from './idb'

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
