// Display settings: how the page draws, not what the reader is looking for — that is
// filterStore's job, and changing one should not change the other. localStorage keeps
// each choice across reloads.
import { createSignal } from 'solid-js'
import { PRICE_MODES, type PriceMode } from '../model/domain'

const DISPLAY_KEY = 'price_display'
const RELATED_KEY = 'related_only_unlocked'
const DEFAULT_MODE: PriceMode = 'once'

/** The three methods readMode needs, so a test can pass a Map instead of localStorage. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Reads the stored mode. A storage that throws (private mode blocks localStorage) is
 *  the caller's problem to catch; this only handles the key. */
export function readMode(store: StorageLike): PriceMode {
  const raw = store.getItem(DISPLAY_KEY)
  // Only a value from PRICE_MODES passes. This catches a hand-edited localStorage and
  // a mode that a later version adds.
  return PRICE_MODES.includes(raw as PriceMode) ? (raw as PriceMode) : DEFAULT_MODE
}

/** Only "1" reads as on, so a hand-edited value cannot switch a view on by accident. */
export function readFlag(store: StorageLike, key: string): boolean {
  return store.getItem(key) === '1'
}

function initial(): PriceMode {
  try {
    return readMode(localStorage)
  } catch {
    return DEFAULT_MODE
  }
}

const [priceMode, setPriceModeSignal] = createSignal<PriceMode>(initial())

export { priceMode }

export function setPriceMode(mode: PriceMode): void {
  setPriceModeSignal(mode)
  try {
    localStorage.setItem(DISPLAY_KEY, mode)
  } catch { /* when the write fails, the next load starts from the default */ }
}

function readFlagAt(key: string): boolean {
  try {
    return readFlag(localStorage, key)
  } catch {
    return false
  }
}

const [relatedOnlyUnlocked, setRelatedOnlyUnlockedSignal] = createSignal(readFlagAt(RELATED_KEY))

export { relatedOnlyUnlocked }

export function setRelatedOnlyUnlocked(on: boolean): void {
  setRelatedOnlyUnlockedSignal(on)
  try {
    // Off removes the key instead of storing "0", so the default state leaves nothing behind
    if (on) localStorage.setItem(RELATED_KEY, '1')
    else localStorage.removeItem(RELATED_KEY)
  } catch { /* when the write fails, the next load starts from the default */ }
}
