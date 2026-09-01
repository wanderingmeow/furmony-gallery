import { createMemo, createRoot, createSignal } from 'solid-js'
import type { AdoptListing } from './types'
import type { FilterTab, SortMode } from './utils'
import {
  colorNames, displayPrice, isLocked, isSelfCommission, publishDate, raceName,
} from './utils'
import { loadListings, mergeListings } from './cache'
import { fetchWithRetry } from './api'

// ---------------------------------------------------------------------------
// Listings + loading state
// ---------------------------------------------------------------------------
export const [listings, setListings] = createSignal<AdoptListing[]>([])
export const [isLoading, setIsLoading] = createSignal(false)
export const [errorMessage, setErrorMessage] = createSignal<string | null>(null)
export const [fetchFailed, setFetchFailed] = createSignal(false) // retries exhausted → refresh button
export const [dataReady, setDataReady] = createSignal(false) // cache or first data loaded → show page

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------
export const [tab, setTab] = createSignal<FilterTab>('all')
export const [sortMode, setSortMode] = createSignal<SortMode>('timeDesc')
export const [selectedColors, setSelectedColors] = createSignal<Set<string>>(new Set())
export const [selectedRaces, setSelectedRaces] = createSignal<Set<string>>(new Set())
export const [searchText, setSearchText] = createSignal('')

// ---------------------------------------------------------------------------
// Wishlist: id -> add timestamp
// ---------------------------------------------------------------------------
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
  } else if (!isLocked(listing)) {
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

function persistWishlist(w: Map<number, number>): void {
  try {
    localStorage.setItem(WISH_KEY, JSON.stringify(Object.fromEntries(w)))
  } catch { /* ignore */ }
}

function loadWishlist(): void {
  try {
    const raw = localStorage.getItem(WISH_KEY)
    if (!raw) return
    const obj = JSON.parse(raw) as Record<string, number>
    const m = new Map<number, number>()
    for (const k in obj) m.set(Number(k), obj[k])
    setWishlist(m)
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Session: lastVisibleId (hasVisited is derived from the listings cache existing)
// ---------------------------------------------------------------------------
const SESSION_KEY = 'furmony_session'
export const [lastVisibleId, setLastVisibleId] = createSignal<number | null>(null)
export const [restored, setRestored] = createSignal(false) // scroll restore done once

function loadSession(): void {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return
    const s = JSON.parse(raw) as { lastVisibleId?: number | null }
    setLastVisibleId(s.lastVisibleId ?? null)
  } catch { /* ignore */ }
}

export function persistSession(): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ lastVisibleId: lastVisibleId() }))
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Derived: filtered list + availability + counts
// ---------------------------------------------------------------------------
// Derived memos are module-level global state — wrap them in a createRoot so
// Solid doesn't warn they'll never be disposed (they're intentionally global).
export let filteredListings: () => AdoptListing[]
export let availableColors: () => string[]
export let availableRaces: () => string[]
export let countAll: () => number
export let countUnlocked: () => number
export let countLocked: () => number
export let wishlistUnlockedCount: () => number
export let wishlistLockedCount: () => number

createRoot(() => {
  filteredListings = createMemo(() => {
    return compute(
      listings(), tab(), sortMode(), selectedColors(), selectedRaces(), searchText(), wishlist(),
    )
  })

  availableColors = createMemo(() => {
    const all = listings().flatMap(colorNames).filter((c) => c.length > 0)
    return [...new Set(all)].sort()
  })

  availableRaces = createMemo(() => {
    const all = listings().map(raceName).filter((r): r is string => !!r && r.length > 0)
    return [...new Set(all)].sort()
  })

  countAll = createMemo(() => listings().filter((l) => !isSelfCommission(l)).length)
  countUnlocked = createMemo(() => listings().filter((l) => !isLocked(l) && !isSelfCommission(l)).length)
  countLocked = createMemo(() => listings().filter((l) => isLocked(l) && !isSelfCommission(l)).length)
  wishlistUnlockedCount = createMemo(() => {
    const wl = wishlist()
    return [...wl.keys()].filter((id) => {
      const l = listings().find((x) => x.adoptId === id)
      return l && !isLocked(l)
    }).length
  })
  wishlistLockedCount = createMemo(() => {
    const wl = wishlist()
    return [...wl.keys()].filter((id) => {
      const l = listings().find((x) => x.adoptId === id)
      return l && isLocked(l)
    }).length
  })
})

function compute(
  listings: AdoptListing[],
  tab: FilterTab,
  sortMode: SortMode,
  selectedColors: Set<string>,
  selectedRaces: Set<string>,
  searchText: string,
  wishlist: Map<number, number>,
): AdoptListing[] {
  let result = listings.filter((l) => !isSelfCommission(l))

  if (selectedColors.size > 0) {
    result = result.filter((l) => {
      const cols = colorNames(l)
      return cols.length > 0 && cols.some((c) => selectedColors.has(c))
    })
  }
  if (selectedRaces.size > 0) {
    result = result.filter((l) => {
      const r = raceName(l)
      return !!r && selectedRaces.has(r)
    })
  }

  switch (tab) {
    case 'unlocked': result = result.filter((l) => !isLocked(l)); break
    case 'locked': result = result.filter((l) => isLocked(l)); break
    case 'wishlist': {
      result = result.filter((l) => wishlist.has(l.adoptId))
      result.sort((a, b) => (wishlist.get(a.adoptId) ?? 0) > (wishlist.get(b.adoptId) ?? 0) ? -1 : 1)
      return result
    }
    case 'all': break
  }

  switch (sortMode) {
    case 'timeDesc': result.sort((a, b) => (publishDate(a)?.getTime() ?? 0) > (publishDate(b)?.getTime() ?? 0) ? -1 : 1); break
    case 'timeAsc': result.sort((a, b) => (publishDate(a)?.getTime() ?? 0) < (publishDate(b)?.getTime() ?? 0) ? -1 : 1); break
    case 'priceAsc': result.sort((a, b) => displayPrice(a) - displayPrice(b)); break
    case 'priceDesc': result.sort((a, b) => displayPrice(b) - displayPrice(a)); break
  }

  if (searchText) {
    const q = searchText.toLowerCase()
    result = result.filter((l) =>
      (l.adoptName?.toLowerCase().includes(q) ?? false) ||
      (l.detailDescription?.toLowerCase().includes(q) ?? false),
    )
  }
  return result
}

// ---------------------------------------------------------------------------
// Data loading: cache-first, fetch, content-compare merge, retry, notifications
// ---------------------------------------------------------------------------
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
    markNewContent()
    // notification diff — first visit has empty oldRows, so nothing to diff; that
    // also serves as the "visited" check, no need for a separate hasVisited flag
    notifyLockChanges(oldRows, newRows)
  }
  setDataReady(true)

  // clean stale wishlist entries
  const valid = new Set(newRows.map((l) => l.adoptId))
  const wl = wishlist()
  let cleaned = false
  const next = new Map(wl)
  for (const id of next.keys()) {
    if (!valid.has(id)) { next.delete(id); cleaned = true }
  }
  if (cleaned) {
    setWishlist(next)
    persistWishlist(next)
  }

  setIsLoading(false)
}

// ---------------------------------------------------------------------------
// Lock-change notifications (top-right toast stack)
// ---------------------------------------------------------------------------
export interface LockChange {
  uid: number
  id: number
  name: string
  headPicture?: string
  isLocked: boolean
}

let notifUid = 0
function nextUid(): number { notifUid += 1; return notifUid }

let navigator: ((path: string) => void) | null = null
export function setNavigator(fn: (path: string) => void): void {
  navigator = fn
}
export function getNavigator(): ((path: string) => void) | null {
  return navigator
}

function notifyLockChanges(oldRows: AdoptListing[], newRows: AdoptListing[]): void {
  if (!oldRows || oldRows.length === 0) return
  const oldDict = new Map(oldRows.map((l) => [l.adoptId, l]))
  const changes: LockChange[] = []
  for (const item of newRows) {
    const name = item.adoptName ?? '未知'
    const old = oldDict.get(item.adoptId)
    // isLock: 2 = locked, 0/1 = unlocked. Only notify when the locked boolean flips.
    if (old && isLocked(old) !== isLocked(item)) {
      changes.push({ uid: nextUid(), id: item.adoptId, name, headPicture: item.adoptHeadPicture, isLocked: isLocked(item) })
    } else if (!old && isLocked(item)) {
      changes.push({ uid: nextUid(), id: item.adoptId, name, headPicture: item.adoptHeadPicture, isLocked: true })
    }
  }
  if (changes.length === 0) return
  // push into a reactive queue consumed by the toast stack component
  enqueueChanges(changes)
}

const [notifications, setNotifications] = createSignal<LockChange[]>([])
export function getNotifications(): LockChange[] {
  return notifications()
}
export function enqueueChanges(changes: LockChange[]): void {
  setNotifications((q) => [...q, ...changes])
}
export function removeNotification(uid: number): void {
  setNotifications((q) => q.filter((n) => n.uid !== uid))
}
export function openDetail(id: number): void {
  if (navigator) navigator(`/detail/${id}`)
}

// ---------------------------------------------------------------------------
// New-content indicator (red dot on back-to-top button)
// ---------------------------------------------------------------------------
export const [newContent, setNewContent] = createSignal(false)
export function markNewContent(): void {
  setNewContent(true)
}
export function clearNewContent(): void {
  setNewContent(false)
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
export function initStore(): void {
  loadSession()
  loadWishlist()
  loadData()
}
