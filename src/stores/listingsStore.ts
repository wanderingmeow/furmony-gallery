// src/stores/listingsStore.ts - listings, loading state, and the load itself.
import { apiLanguage, requestedLocale, tr } from "../i18n";
import type { Locale } from "../i18n";
import { batch, createSignal } from "solid-js";
import type { AdoptListing } from "../model/types";
import { mergeListings, readCache, type Cache } from "../data/listingCache";
import { fetchAllListings, type ListAnswer } from "../data/api";
import { isSelfCommission } from "../model/domain";
import { rememberWords } from "../model/translatedText";
import { cleanStaleWishlist } from "./wishlistStore";
import { notifyListingChanges } from "./notificationStore";

export const [listings, setListings] = createSignal<AdoptListing[]>([]);

/** A load that did not finish: the two lines the dialog opens with. */
export interface LoadError {
  title: string;
  line: string;
}

export const [loadError, setLoadError] = createSignal<LoadError | null>(null);

/** Whether the page has anything to draw. A warm cache answers this before any request runs, and
 *  a failed request can still leave rows up, so it is not a phase of the request. */
export const [dataReady, setDataReady] = createSignal(false);

/** What the page owes a request. One value, so a load cannot be in flight and given up on at the
 *  same time. `failed` is the refresh button's reason, and starting a load retires it. */
const [request, setRequest] = createSignal<"idle" | "running" | "failed">(
  "idle",
);
export const isLoading = () => request() === "running";
export const fetchFailed = () => request() === "failed";

// One message for any list that did not come back. Which list failed does not change what the
// reader does next.
const listFailed = (): LoadError => ({
  title: tr("error.loadTitle"),
  line: tr("error.loadLine"),
});

/**
 * The rows the page is drawn from. Self-commission pieces are dropped here, where rows enter the
 * store, so no list, chart, count or bar needs a rule for them. The API answer, the cache and the
 * stale-id cleanup still see those rows.
 */
const pageRows = (rows: AdoptListing[]): AdoptListing[] =>
  rows.filter((l) => !isSelfCommission(l));

/**
 * The load the page waits on; only it may write the screen. Both languages are held here because
 * the reader can pick another one while the answer is on its way.
 */
interface Load {
  apiLang: string;
  locale: Locale;
  controller: AbortController;
  /** False once a newer load has taken the screen. */
  current(): boolean;
}

let active: Load | null = null;

/** Take the screen from whatever load held it, and call that one off: an answer that arrives
 *  afterwards belongs to a question nobody is asking. */
function beginLoad(): Load {
  active?.controller.abort();
  const load: Load = {
    apiLang: apiLanguage(),
    locale: requestedLocale(),
    controller: new AbortController(),
    current: () => active === load,
  };
  active = load;
  return load;
}

/** The saved rows go up first: an IndexedDB read is quick, and a page that waits on the network
 *  shows a blank. A cache kept in another language holds the wrong words, so it never paints; the
 *  fetch still merges into the rows it left on screen. */
function showCache(cache: Cache | null, apiLang: string): void {
  if (!cache || cache.lang !== apiLang) return;
  setListings(pageRows(cache.rows));
  setDataReady(true);
}

/** The dialog's lines, and what to leave under them. Rows from the last successful request are
 *  still on screen, so this request was a refresh. On a cold start the saved rows go up even when
 *  the cache holds them in another language: a page of pictures beats an error line. Rows left
 *  without an answer keep the names in the language before it, which is what `wordsPending`
 *  holds placeholders for. */
async function showFailure(e: unknown): Promise<void> {
  console.error("[api] fetch failed after retries", e);
  setRequest("failed");
  if (listings().length > 0) {
    setLoadError(listFailed());
    setDataReady(true);
    return;
  }
  const fallback = await readCache();
  if (fallback && fallback.rows.length > 0) {
    setListings(pageRows(fallback.rows));
    setDataReady(true);
  } else {
    setLoadError(listFailed());
  }
}

/** The rows a new answer merges into: the cards the reader is looking at, words aside, or the
 *  saved rows when the screen is cold. */
const rowsToMerge = (
  onScreen: AdoptListing[],
  cached: Cache | null,
): AdoptListing[] => (onScreen.length > 0 ? onScreen : (cached?.rows ?? []));

async function applyAnswer(
  load: Load,
  answer: ListAnswer<AdoptListing>,
  cached: Cache | null,
): Promise<void> {
  const oldRows = rowsToMerge(listings(), cached);
  const { updated, changed } = await mergeListings(
    oldRows,
    answer.rows,
    load.apiLang,
    load.current,
    answer.complete,
  );
  if (!load.current()) return;
  // The words and the rows land in the same turn, which is the moment a name stops waiting.
  batch(() => {
    if (changed) {
      rememberWords(answer.rows, load.locale);
      setListings(pageRows(updated));
      // The notification diff. On a first visit oldRows is empty, so nothing is announced, and
      // that doubles as the "have we visited before" check: no extra flag is needed.
      notifyListingChanges(pageRows(oldRows), pageRows(updated));
    }
    setDataReady(true);
  });
  // Hearts are pruned only by a full answer. A half answer shows the dialog instead, and the rows
  // it left out stay starred.
  if (answer.complete)
    cleanStaleWishlist(new Set(updated.map((l) => l.adoptId)));
  else setLoadError(listFailed());
  setRequest("idle");
}

export async function loadData(): Promise<void> {
  const load = beginLoad();

  const cache = await readCache();
  if (!load.current()) return;
  showCache(cache, load.apiLang);

  setRequest("running");
  setLoadError(null);

  let answer: ListAnswer<AdoptListing>;
  try {
    answer = await fetchAllListings(
      undefined,
      load.controller.signal,
      load.apiLang,
    );
  } catch (e) {
    // A load a newer one replaced, or a request this one cancelled, is not a fetch failure.
    if (!load.current()) return;
    await showFailure(e);
    return;
  }

  if (!load.current()) return;
  await applyAnswer(load, answer, cache);
}
