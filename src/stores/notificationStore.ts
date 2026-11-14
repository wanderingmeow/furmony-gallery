// src/stores/notificationStore.ts — change notifications (top-right toast stack).
import { createSignal } from 'solid-js'
import type { AdoptListing } from '../model/types'
import { displayPrice, isLocked } from '../model/domain'

export type ListingChange =
  | { uid: number; id: number; name: string; headPicture?: string; kind: 'lock'; isLocked: boolean }
  | { uid: number; id: number; name: string; headPicture?: string; kind: 'price'; from: number; to: number }

let notifUid = 0
function nextUid(): number { notifUid += 1; return notifUid }

const [notifications, setNotifications] = createSignal<ListingChange[]>([])
export function getNotifications(): ListingChange[] {
  return notifications()
}
export function enqueueChanges(changes: ListingChange[]): void {
  setNotifications((q) => [...q, ...changes])
}
export function removeNotification(uid: number): void {
  setNotifications((q) => q.filter((n) => n.uid !== uid))
}

// Watched: the lock flag (isLocked) and the full price shown on the card (displayPrice).
// Not watched: allcost, earnest, discount.
export function notifyListingChanges(oldRows: AdoptListing[], newRows: AdoptListing[]): void {
  if (!oldRows || oldRows.length === 0) return
  const oldDict = new Map(oldRows.map((l) => [l.adoptId, l]))
  const changes: ListingChange[] = []
  for (const item of newRows) {
    const name = item.adoptName ?? '未知'
    const old = oldDict.get(item.adoptId)
    if (old && isLocked(old) !== isLocked(item)) {
      changes.push({ uid: nextUid(), id: item.adoptId, name, headPicture: item.adoptHeadPicture, kind: 'lock', isLocked: isLocked(item) })
    } else if (!old && isLocked(item)) {
      // a row that just appeared already locked is worth reporting: a lock is easy to miss
      changes.push({ uid: nextUid(), id: item.adoptId, name, headPicture: item.adoptHeadPicture, kind: 'lock', isLocked: true })
    }
    if (old) {
      const from = displayPrice(old)
      const to = displayPrice(item)
      // Any change counts, in either direction: across the 1020 rows shared by the 2026-09-02
      // and 2026-11-06 snapshots the price never moved once, so a threshold would filter
      // nothing while swallowing small step-ups.
      // displayPrice() reads a missing value as 0, hence the > 0 guard.
      if (from > 0 && to > 0 && from !== to) {
        changes.push({ uid: nextUid(), id: item.adoptId, name, headPicture: item.adoptHeadPicture, kind: 'price', from, to })
      }
    }
  }
  if (changes.length === 0) return
  enqueueChanges(changes)
}
