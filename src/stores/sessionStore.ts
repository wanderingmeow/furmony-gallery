// src/stores/sessionStore.ts — scroll-restoration session state (firstVisibleId).
// The stored id is the FIRST row visible at the top of the viewport (not "last").
import { createSignal } from 'solid-js'

const SESSION_KEY = 'furmony_session'

export const [firstVisibleId, setFirstVisibleId] = createSignal<number | null>(null)

export function loadSession(): void {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return
    // prefer the canonical `firstVisibleId` field; fall back to the legacy
    // `lastVisibleId` key so sessions stored before the rename still restore
    const s = JSON.parse(raw) as { firstVisibleId?: number | null; lastVisibleId?: number | null }
    setFirstVisibleId(s.firstVisibleId ?? s.lastVisibleId ?? null)
  } catch { /* ignore */ }
}

/** Store the row the reader is on, so a refresh returns to it. */
export function persistSession(firstVisibleId: number | null): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ firstVisibleId }))
  } catch { /* ignore */ }
}
