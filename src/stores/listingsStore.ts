// src/stores/listingsStore.ts — listings + loading state, data loading, new-content dot.
import { createSignal } from 'solid-js'
import type { AdoptListing } from '../types'
import { loadListings, mergeListings } from '../listingCache'
import { fetchWithRetry } from '../api'
import { cleanStaleWishlist } from './wishlistStore'
import { notifyLockChanges } from './notificationStore'

export const [listings, setListings] = createSignal<AdoptListing[]>([])
export const [isLoading, setIsLoading] = createSignal(false)
export const [errorMessage, setErrorMessage] = createSignal<string | null>(null)
export const [fetchFailed, setFetchFailed] = createSignal(false) // retries exhausted → refresh button
export const [dataReady, setDataReady] = createSignal(false) // cache or first data loaded → show page

export const [newContent, setNewContent] = createSignal(false)
export function markNewContent(): void { setNewContent(true) }
export function clearNewContent(): void { setNewContent(false) }

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
    newRows = await fetchWithRetry(3)
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
    // new content means changed since a prior visit
    if (oldRows.length > 0) markNewContent()
    // notification diff — first visit has empty oldRows, so nothing to diff; that
    // also serves as the "visited" check, no need for a separate hasVisited flag
    notifyLockChanges(oldRows, newRows)
  }
  setDataReady(true)

  // clean stale wishlist entries (ids removed from the API)
  cleanStaleWishlist(new Set(newRows.map((l) => l.adoptId)))

  setIsLoading(false)
}
