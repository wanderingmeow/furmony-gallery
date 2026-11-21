// Maps an image path to one stable signed URL, and keeps that map across visits in IndexedDB.
// Reads go through an in-memory Map. Writes are debounced, and only the paths changed since the
// last write go to the store.
import { IMG_URL_STORE, putMany, readAll } from "./idb";

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
// already holds the saved URL in its HTTP cache, so reusing it is what makes the picture load
// from cache on the next visit.
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
 * The URL without its signature. The API signs the same path again on every request, so the
 * path is what identifies an image across visits. Anything that is not an http(s) URL, such as
 * a `data:` address, is returned unchanged.
 */
export function urlPath(raw: string): string {
  if (!/^https?:\/\//i.test(raw)) return raw;
  const q = raw.indexOf("?");
  return q === -1 ? raw : raw.slice(0, q);
}

/**
 * The URL to put in `src`. The browser caches an image by its full URL, so the fresh signature
 * the API just handed out misses the cache even when the picture is already there. This returns
 * the first URL seen for the path, which the browser does have cached, and remembers it across
 * visits.
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

/**
 * The same picture, sized for the space that displays it. Covers arrive far larger than any
 * card or slot in the app, and often as PNG, so the list loads far more bytes than it shows.
 *
 * The bucket resizes and re-encodes on request. It accepts this parameter on a signed address
 * because the signature covers only the parameters it lists.
 *
 * The `>` on every cap means shrink only: a picture smaller than the cap stays as it is. That
 * keeps the aspect ratio, which matters because the full-screen zoom opens on the `detail`
 * address and later puts the original picture over it.
 *
 * `card` is the list and the related strip. `badge` is the small head picture and the
 * notification avatar, which would otherwise need a whole cover to fill a circle. `detail` is
 * the large picture in the sheet.
 *
 * No other host accepts this parameter, so everything else passes through untouched,
 * including the `data:` addresses that development mode reads. A bucket that ignores the
 * parameter returns the original picture. A bucket that rejects it fails the load, and
 * onImageError then retries the plain address.
 *
 * `/strip` drops metadata. One cover came back at many times the size its pixels need. The
 * extra bytes were metadata: the source file carries a large XMP block, and the bucket copies it
 * into every output, even into low-quality re-encodes. Turning the quality down barely helps;
 * stripping the metadata does. The ICC profile survives, so colors do not shift. No cover on
 * this bucket carries an EXIF orientation tag, so nothing needs rotating.
 */
const PRESET = {
  card: "imageMogr2/thumbnail/600x%3E/quality/80/format/webp/strip",
  detail: "imageMogr2/thumbnail/1300x%3E/quality/85/format/webp/strip",
  badge: "imageMogr2/thumbnail/180x%3E/quality/80/format/webp/strip",
} as const;

export function sizedUrl(
  url: string | undefined,
  preset: keyof typeof PRESET,
): string | undefined {
  if (!url || !/^https:\/\/[^/]*\.myqcloud\.com\//i.test(url)) return url;
  if (url.includes("imageMogr2")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${PRESET[preset]}`;
}

/**
 * Downloads a picture in the background. `ready` settles with the element once the download
 * finishes. A failed download settles it too, so the caller can still show something.
 *
 * `cancel` stops a download the caller does not need. Dropping the element does not stop the
 * download, so a reader who has moved on still pays for it.
 *
 * After cancel, `ready` never settles. Clearing an address that is still pending fires an error
 * on the element, and the caller would read that error as a finished load.
 */
export function preloadImage(src: string): {
  ready: Promise<HTMLImageElement>;
  cancel: () => void;
} {
  const img = new Image();
  let settle!: (pic: HTMLImageElement) => void;
  const ready = new Promise<HTMLImageElement>((resolve) => {
    settle = resolve;
  });
  let alive = true;
  img.onload = () => {
    if (alive) settle(img);
  };
  img.onerror = () => {
    if (alive) settle(img);
  };
  img.src = src;
  return {
    ready,
    cancel: () => {
      alive = false;
      // A download that already finished has nothing left to stop.
      if (!img.complete) img.src = "";
    },
  };
}

// Whether the browser can hand this picture over without a download. `complete` right after
// `src` is that question: it is true when the picture is in memory, and false when it still has
// to arrive. A picture that is not cached starts a download here, which is the one the caller is
// about to make, so the browser fetches once.
export function imageReady(src: string): boolean {
  const pic = new Image();
  pic.src = src;
  return pic.complete && pic.naturalWidth > 0;
}

// A URL remembered from an earlier visit can expire. On a failed load, the newest signed URL seen
// for this path takes over this element, up to twice, and the map as well.
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
 * Flush the map when the page goes away. Both events are registered, because mobile Safari
 * fires `pagehide` and often skips `beforeunload`. Only the first one writes: the flush is
 * best-effort, and starting it twice adds a second IndexedDB write and nothing else.
 */
export function flushUrlMapOnExit(): void {
  let flushed = false;
  const once = (): void => {
    if (flushed) return;
    flushed = true;
    void flushImageUrlMap();
  };
  window.addEventListener("beforeunload", once);
  window.addEventListener("pagehide", once);
}

export function flushImageUrlMap(): Promise<void> {
  if (!imageUrlMap || !persistTimer) return Promise.resolve();
  clearTimeout(persistTimer);
  persistTimer = null;
  return persistNow();
}
