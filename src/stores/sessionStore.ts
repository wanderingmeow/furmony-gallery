// src/stores/sessionStore.ts — scroll-restoration session state (firstVisibleId).
// The stored id is the FIRST row visible at the top of the viewport (not "last").
import { createSignal } from 'solid-js'

const SESSION_KEY = 'furmony_session'

export const [firstVisibleId, setFirstVisibleId] = createSignal<number | null>(null)
export const [restored, setRestored] = createSignal(false) // scroll restore done once

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

export function persistSession(): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ firstVisibleId: firstVisibleId() }))
  } catch { /* ignore */ }
}
