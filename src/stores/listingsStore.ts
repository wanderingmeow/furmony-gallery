// src/stores/listingsStore.ts — listings + loading state, data loading.
import { createSignal } from 'solid-js'
import type { AdoptListing } from '../model/types'
import { loadListings, mergeListings } from '../data/listingCache'
import { fetchAllListings } from '../data/api'
import { cleanStaleWishlist } from './wishlistStore'
import { notifyListingChanges } from './notificationStore'

export const [listings, setListings] = createSignal<AdoptListing[]>([])
export const [isLoading, setIsLoading] = createSignal(false)
export const [errorMessage, setErrorMessage] = createSignal<string | null>(null)
export const [fetchFailed, setFetchFailed] = createSignal(false) // retries exhausted → refresh button
export const [dataReady, setDataReady] = createSignal(false) // cache or first data loaded → show page

export async function loadData(): Promise<void> {
  // 1. cache → immediate render (IndexedDB read is async but fast)
  const cached = await loadListings()
  if (cached && cached.length > 0) {
    setListings(cached)
    setDataReady(true)
  }

  setIsLoading(true)
  setErrorMessage(null)
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
        setListings(fallback)
        setDataReady(true)
      } else {
        setErrorMessage('网络连接失败，请检查网络设置')
      }
    } else {
      setDataReady(true)
    }
    setIsLoading(false)
    return
  }

  const oldRows = cached ?? []
  const { changed } = await mergeListings(oldRows, newRows)

  if (changed) {
    setListings(newRows)
    // notification diff — first visit has empty oldRows, so nothing to diff; that
    // also serves as the "visited" check, no need for a separate hasVisited flag
    notifyListingChanges(oldRows, newRows)
  }
  setDataReady(true)

  // clean stale wishlist entries (ids removed from the API)
  cleanStaleWishlist(new Set(newRows.map((l) => l.adoptId)))

  setIsLoading(false)
}
