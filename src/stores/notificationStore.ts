// src/stores/notificationStore.ts — lock-change notifications (top-right toast stack).
import { createSignal } from 'solid-js'
import type { AdoptListing } from '../types'
import { isLocked } from '../domain'

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

// Diff old vs new rows for lock flips and push notifications. Called by the listings
// store after a content-changed load; first visit has empty oldRows → nothing to diff.
export function notifyLockChanges(oldRows: AdoptListing[], newRows: AdoptListing[]): void {
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
