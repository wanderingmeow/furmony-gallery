// src/stores/wishlistStore.ts — wishlist state + localStorage persistence.
import { createSignal } from 'solid-js'
import type { AdoptListing } from '../types'

const WISH_KEY = 'furmony_wishlist'

export const [wishlist, setWishlist] = createSignal<Map<number, number>>(new Map())

export function isWishlisted(id: number): boolean {
  return wishlist().has(id)
}

export function toggleWishlist(listing: AdoptListing): void {
  const id = listing.adoptId
  const cur = wishlist()
  const next = new Map(cur)
  if (cur.has(id)) {
    next.delete(id)
  } else {
    next.set(id, Date.now())
  }
  setWishlist(next)
  persistWishlist(next)
}

export function removeFromWishlist(id: number): void {
  const cur = wishlist()
  const next = new Map(cur)
  next.delete(id)
  setWishlist(next)
  persistWishlist(next)
}

// Drop wishlist entries whose id no longer exists in the fetched listings (they were
// removed from the API). Called by the listings store after a successful load.
export function cleanStaleWishlist(validIds: Set<number>): boolean {
  const wl = wishlist()
  let cleaned = false
  const next = new Map(wl)
  for (const id of next.keys()) {
    if (!validIds.has(id)) { next.delete(id); cleaned = true }
  }
  if (cleaned) {
    setWishlist(next)
    persistWishlist(next)
  }
  return cleaned
}

function persistWishlist(w: Map<number, number>): void {
  try {
    localStorage.setItem(WISH_KEY, JSON.stringify(Object.fromEntries(w)))
  } catch { /* ignore */ }
}

export function loadWishlist(): void {
  try {
    const raw = localStorage.getItem(WISH_KEY)
    if (!raw) return
    const obj = JSON.parse(raw) as Record<string, number>
    const m = new Map<number, number>()
    for (const k in obj) m.set(Number(k), obj[k])
    setWishlist(m)
  } catch { /* ignore */ }
}
