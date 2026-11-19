// src/stores/listingsStore.ts - listings, loading state, and the load itself.
import { createSignal } from 'solid-js'
import type { AdoptListing } from '../model/types'
import { loadListings, mergeListings } from '../data/listingCache'
import { fetchAllListings } from '../data/api'
import { isSelfCommission } from '../model/domain'
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
  // 1. cache → immediate render (IndexedDB read is async but fast)
  const cached = await loadListings()
  if (cached && cached.length > 0) {
    setListings(onShelf(cached))
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
      const fallback = await loadListings()
      if (fallback && fallback.length > 0) {
        setListings(onShelf(fallback))
        setDataReady(true)
      } else {
        setLoadError({ title: '载入失败', line: '网络连接失败，请检查网络设置' })
      }
    } else {
      // Rows from the last successful request are still on screen, so this request was a
      // refresh.
      setLoadError({ title: '没能刷新', line: '页面上还是上一次的内容' })
      setDataReady(true)
    }
    setIsLoading(false)
    return
  }

  const oldRows = cached ?? []
  const { updated, changed } = await mergeListings(oldRows, newRows)

  if (changed) {
    setListings(onShelf(updated))
    // The notification diff. On a first visit oldRows is empty, so nothing is announced, and
    // that doubles as the "have we visited before" check: no extra flag is needed.
    notifyListingChanges(onShelf(oldRows), onShelf(updated))
  }
  setDataReady(true)

  // clean stale wishlist entries (ids removed from the API)
  cleanStaleWishlist(new Set(updated.map((l) => l.adoptId)))

  setIsLoading(false)
}
