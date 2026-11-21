// The neighbor table is 48 KB gzipped, so we fetch it on the first detail open instead of at
// startup. It is refreshed with the published site rather than shipped from this repository,
// so the copy under public/ is only a development fallback. If the fetch fails, the row stays
// hidden rather than showing a stale one.
//
// On failure we log and draw nothing. The row is an extra, and a toast about a missing file
// would be worse than the missing row.
import { createSignal } from "solid-js";
import { EMPTY_TABLE, parseRelated, type RelatedTable } from "../model/related";

const [related, setRelated] = createSignal<RelatedTable>(EMPTY_TABLE);

// Whether the fetch is over. The row keeps a placeholder up until this flips, so a failed
// load has to flip it too: a spinner that never stops tells the reader less than a row that
// is simply not there.
const [relatedLoaded, setRelatedLoaded] = createSignal(false);

export { related, relatedLoaded };

let inflight: Promise<void> | null = null;

export function loadRelated(): Promise<void> {
  if (!inflight) inflight = fetchRelated();
  return inflight;
}

async function fetchRelated(): Promise<void> {
  try {
    // BASE_URL is the configured sub-path WITHOUT a trailing slash (base: '/furmony-gallery'),
    // so add one: public/related.json is served at <base>/related.json.
    const base = import.meta.env.BASE_URL.replace(/\/+$/, "") + "/";
    const res = await fetch(`${base}related.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching related.json`);
    const table = parseRelated(await res.json());
    if (table.neighbors.size === 0)
      throw new Error("related.json carries no neighbor data");
    setRelated(table);
  } catch (err) {
    console.error("[related] load failed", err);
    inflight = null; // allow a retry on the next detail open
  } finally {
    setRelatedLoaded(true);
  }
}
