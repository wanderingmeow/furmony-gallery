// src/stores/listingsStore.ts - listings, loading state, and the load itself.
import { apiLanguage, requestedLocale, tr } from '../i18n'
import { batch, createSignal } from 'solid-js'
import type { AdoptListing } from '../model/types'
import { mergeListings, readCache } from '../data/listingCache'
import { fetchAllListings } from '../data/api'
import { isSelfCommission } from '../model/domain'
import { rememberWords } from '../model/translatedText'
import { cleanStaleWishlist } from './wishlistStore'
import { notifyListingChanges } from './notificationStore'

export const [listings, setListings] = createSignal<AdoptListing[]>([])
export const [isLoading, setIsLoading] = createSignal(false)
/** A load that did not finish: what the banner at the top of the page says, in two lines. */
export interface LoadError {
  title: string
  line: string
}

export const [loadError, setLoadError] = createSignal<LoadError | null>(null)
export const [fetchFailed, setFetchFailed] = createSignal(false) // retries exhausted → refresh button
export const [dataReady, setDataReady] = createSignal(false) // cache or first data loaded → show page

/**
 * The rows the page is drawn from. Self-commission pieces are dropped here, where rows enter the
 * store, so no list, chart, count or bar needs a rule for them. The API answer, the cache and the
 * stale-id cleanup still see those rows.
 */
const onShelf = (rows: AdoptListing[]): AdoptListing[] => rows.filter((l) => !isSelfCommission(l))

export async function loadData(): Promise<void> {
  const lang = apiLanguage()
  // The language this request is asked in. A second pick while the answer is on its way moves
  // `requestedLocale`, so the words that land are labelled with the language held here.
  const asked = requestedLocale()
  // The saved rows go up first: an IndexedDB read is quick, and a page that waits on the network
  // shows a blank. A cache kept in another language holds the wrong words and never paints, and the
  // rows already on screen stay. The fetch below still merges into them.
  const cache = await readCache()
  if (cache && cache.lang === lang) {
    setListings(onShelf(cache.rows))
    setDataReady(true)
  }

  setIsLoading(true)
  setLoadError(null)
  setFetchFailed(false)

  let newRows: AdoptListing[]
  try {
    newRows = await fetchAllListings()
  } catch (e) {
    console.error('[api] fetch failed after retries', e)
    setFetchFailed(true)
    if (listings().length === 0) {
      // Nothing else to show, so the saved rows go up even when the shelf answered them in
      // another language: a page of pictures beats an error line.
      const fallback = await readCache()
      if (fallback && fallback.rows.length > 0) {
        setListings(onShelf(fallback.rows))
        setDataReady(true)
      } else {
        setLoadError({ title: tr('error.loadTitle'), line: tr('error.loadLine') })
      }
    } else {
      // Rows from the last successful request are still on screen, so this request was a refresh.
      setLoadError({ title: tr('error.reloadTitle'), line: tr('error.reloadLine') })
      setDataReady(true)
    }
    setIsLoading(false)
    // The screen is already on the language the reader picked, so an answer that never came leaves
    // the names on the rows in the language before it. `wordsPending` keeps those spaces
    // placeholders, and the banner above offers the next try.
    return
  }

  // The rows the page holds are the cards the reader is looking at, words aside, so they are what
  // a new answer is merged into. A cold start holds none, and the saved rows stand in.
  const oldRows = listings().length > 0 ? listings() : (cache?.rows ?? [])
  const { updated, changed } = await mergeListings(oldRows, newRows, lang)

  // The words and the rows land in the same turn, which is the moment a name stops waiting.
  batch(() => {
    if (changed) {
      rememberWords(newRows, asked)
      setListings(onShelf(updated))
      // The notification diff. On a first visit oldRows is empty, so nothing is announced, and
      // that doubles as the "have we visited before" check: no extra flag is needed.
      notifyListingChanges(onShelf(oldRows), onShelf(updated))
    }
    setDataReady(true)
  })
  // clean stale wishlist entries (ids removed from the API)
  cleanStaleWishlist(new Set(updated.map((l) => l.adoptId)))

  setIsLoading(false)
}
