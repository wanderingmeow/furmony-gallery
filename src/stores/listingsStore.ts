// src/stores/listingsStore.ts - listings, loading state, and the load itself.
import { apiLanguage, requestedLocale, tr } from "../i18n";
import type { Locale } from "../i18n";
import { batch, createSignal } from "solid-js";
import type { AdoptListing } from "../model/types";
import { mergeListings, readCache } from "../data/listingCache";
import { fetchAllListings, type ListAnswer } from "../data/api";
import { isSelfCommission } from "../model/domain";
import { rememberWords } from "../model/translatedText";
import { cleanStaleWishlist } from "./wishlistStore";
import { notifyListingChanges } from "./notificationStore";

export const [listings, setListings] = createSignal<AdoptListing[]>([]);
export const [isLoading, setIsLoading] = createSignal(false);
/** A load that did not finish: the two lines the dialog opens with. */
export interface LoadError {
  title: string;
  line: string;
}

export const [loadError, setLoadError] = createSignal<LoadError | null>(null);
export const [fetchFailed, setFetchFailed] = createSignal(false); // retries exhausted → refresh button
export const [dataReady, setDataReady] = createSignal(false); // cache or first data loaded → show page

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
 * The load the page waits on; only it may write the screen. Both languages are held here because the
 * reader can pick another one while the answer is on its way.
 */
interface Load {
  apiLang: string;
  locale: Locale;
  controller: AbortController;
}
let active: Load | null = null;

export async function loadData(): Promise<void> {
  active?.controller.abort();
  const me: Load = {
    apiLang: apiLanguage(),
    locale: requestedLocale(),
    controller: new AbortController(),
  };
  active = me;
  const current = () => active === me;

  // The saved rows go up first: an IndexedDB read is quick, and a page that waits on the network
  // shows a blank. A cache kept in another language holds the wrong words and never paints, and the
  // rows already on screen stay. The fetch below still merges into them.
  const cache = await readCache();
  if (!current()) return;
  if (cache && cache.lang === me.apiLang) {
    setListings(pageRows(cache.rows));
    setDataReady(true);
  }

  setIsLoading(true);
  setLoadError(null);
  setFetchFailed(false);

  let answer: ListAnswer<AdoptListing>;
  try {
    answer = await fetchAllListings(
      undefined,
      me.controller.signal,
      me.apiLang,
    );
  } catch (e) {
    // A load a newer one replaced, or a request this one cancelled, is not a fetch failure.
    if (!current()) return;
    console.error("[api] fetch failed after retries", e);
    setFetchFailed(true);
    if (listings().length === 0) {
      // Nothing else to show, so the saved rows go up even when the API answered them in
      // another language: a page of pictures beats an error line.
      const fallback = await readCache();
      if (fallback && fallback.rows.length > 0) {
        setListings(pageRows(fallback.rows));
        setDataReady(true);
      } else {
        setLoadError(listFailed());
      }
    } else {
      // Rows from the last successful request are still on screen, so this request was a refresh.
      setLoadError(listFailed());
      setDataReady(true);
    }
    setIsLoading(false);
    // The screen is already on the language the reader picked, so an answer that never came leaves
    // the names on the rows in the language before it. `wordsPending` keeps those spaces
    // placeholders, and the dialog offers the next try.
    return;
  }

  // The rows the page holds are the cards the reader is looking at, words aside, so they are what
  // a new answer is merged into. A cold start holds none, and the saved rows stand in.
  if (!current()) return;
  const oldRows = listings().length > 0 ? listings() : (cache?.rows ?? []);
  const { updated, changed } = await mergeListings(
    oldRows,
    answer.rows,
    me.apiLang,
    current,
    answer.complete,
  );
  if (!current()) return;
  // The words and the rows land in the same turn, which is the moment a name stops waiting.
  batch(() => {
    if (changed) {
      rememberWords(answer.rows, me.locale);
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

  setIsLoading(false);
}
