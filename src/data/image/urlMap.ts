// Maps an image path to one stable signed URL, and keeps that map across visits in IndexedDB.
// Reads go through an in-memory Map. Writes are debounced, and only the paths changed since the last
// write go to the store.
import { IMG_URL_STORE, putMany, readAll } from "../idb";

let imageUrlMap: Map<string, string> | null = null;
const recentRaw = new Map<string, string>(); // path -> newest signed URL, for the error retry
let dirtyPaths: Set<string> | null = null; // paths added since the last write
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function loadMap(): Map<string, string> {
  if (!imageUrlMap) imageUrlMap = new Map();
  return imageUrlMap;
}

async function persistNow(): Promise<void> {
  const dirty = dirtyPaths;
  dirtyPaths = null;
  if (!dirty || dirty.size === 0) return;
  try {
    const map = loadMap();
    const entries: [string, string][] = [];
    for (const path of dirty) {
      const url = map.get(path);
      if (url) entries.push([path, url]);
    }
    await putMany(IMG_URL_STORE, entries);
  } catch {
    /* IndexedDB unavailable */
  }
}

function persist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistNow();
  }, 1000);
}

/** Put this path in the queue that the next write to IndexedDB takes. */
function markDirty(path: string): void {
  if (!dirtyPaths) dirtyPaths = new Set();
  dirtyPaths.add(path);
  persist();
}

// Load the saved map into memory. A saved URL beats a newer one from this session: the browser
// already holds the saved URL in its HTTP cache, so reusing it is what makes the picture load from
// cache on the next visit.
export async function initImageUrlMap(): Promise<void> {
  loadMap();
  try {
    const dbMap = await readAll<string, string>(IMG_URL_STORE);
    for (const [path, url] of dbMap) imageUrlMap!.set(path, url);
  } catch {
    /* IndexedDB unavailable */
  }
}

/**
 * The URL without its signature. The API signs the same path again on every request, so the path is
 * what identifies an image across visits. Anything that is not an http(s) URL, such as a `data:`
 * address, is returned unchanged.
 */
export function urlPath(raw: string): string {
  if (!/^https?:\/\//i.test(raw)) return raw;
  const q = raw.indexOf("?");
  return q === -1 ? raw : raw.slice(0, q);
}

/**
 * The URL to put in `src`. The browser caches an image by its full URL, so the fresh signature the
 * API just handed out misses the cache even when the picture is already there. This returns the
 * first URL seen for the path, which the browser does have cached, and remembers it across visits.
 */
export function stableImageUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  const path = urlPath(raw);
  if (path === raw) return raw;
  recentRaw.set(path, raw);
  const map = loadMap();
  const memo = map.get(path);
  if (memo) return memo;
  map.set(path, raw);
  markDirty(path);
  return raw;
}

// A URL remembered from an earlier visit can expire. On a failed load, the newest signed URL seen for
// this path takes over this element, up to twice, and the map as well.
export function onImageError(e: Event): void {
  const img = e.target as HTMLImageElement;
  if (!img) return;
  const tries = Number(img.dataset.retry || 0);
  if (tries >= 2) return;
  const src = img.currentSrc || img.src;
  const path = urlPath(src);
  const fresh = recentRaw.get(path);
  img.dataset.retry = String(tries + 1);
  const map = loadMap();
  if (fresh && map.get(path) !== fresh) {
    // Every later read of this path is handed what the map holds, and this element just failed to
    // load what is in there now.
    map.set(path, fresh);
    markDirty(path);
  }
  img.src = fresh && fresh !== src ? fresh : src;
}

/**
 * Flush the map when the page goes away. Both events are registered, because mobile Safari fires
 * `pagehide` and often skips `beforeunload`. Only the first one writes: the flush is best-effort,
 * and starting it twice adds a second IndexedDB write and nothing else.
 */
export function flushUrlMapOnExit(): void {
  let flushed = false;
  const once = (): void => {
    if (flushed) return;
    flushed = true;
    const pending = persistTimer;
    if (!pending) return;
    clearTimeout(pending);
    persistTimer = null;
    void persistNow();
  };
  window.addEventListener("beforeunload", once);
  window.addEventListener("pagehide", once);
}
