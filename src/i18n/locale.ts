// Which language the app is on screen in, and where that choice is kept.
//
// The signals live at module level, held in a root the way the other stores hold theirs. A language
// is a property of the whole visit, and a large share of the app's strings are built in model/ and
// stores/, where no component context reaches.
//
// Two signals, because one pick touches two things: the requests and the screen. The screen moves at
// once. A request keeps the language it was asked in, so an answer on its way is matched to the
// language it belongs to, even when the reader picks again before it lands.
import { createRoot, createSignal } from 'solid-js'
import {
  API_LANGUAGE, asLocale, DEFAULT_LOCALE, DOC_LANG, LOCALE_KEY, localeFromTag, type Locale,
} from './apiLanguage'

export { API_LANGUAGE, LOCALE_NAME, type Locale } from './apiLanguage'
export { LOCALES, LOCALE_KEY, resolveApiLanguage } from './apiLanguage'

/** The language the reader's browser speaks, falling back to the language the data is written in. */
export function browserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE
  return localeFromTag(navigator.language ?? '') ?? DEFAULT_LOCALE
}

function readStored(): Locale | null {
  try {
    return asLocale(localStorage.getItem(LOCALE_KEY))
  } catch {
    // Nothing stored. The browser's language decides.
    return null
  }
}

const [requested, setRequested, shown, setShown] = createRoot(() => {
  const initial = readStored() ?? browserLocale()
  const ask = createSignal<Locale>(initial)
  const screen = createSignal<Locale>(initial)
  return [ask[0], ask[1], screen[0], screen[1]] as const
})

/** The language on screen. Everything the reader reads follows this one. */
export const locale = shown

/** The language the requests ask the shelf in. An answer on its way belongs to the language it was
 *  asked in, which is what `model/translatedText` compares against `locale`. */
export const requestedLocale = requested

/** The code the list requests ask the API in. */
export const apiLanguage = (): string => API_LANGUAGE[requested()]

/** Say the language to the document, which is what a screen reader and the browser's own
 *  translation tool look at. */
export function applyDocumentLocale(): void {
  document.documentElement.lang = DOC_LANG[locale()]
}

/**
 * Move to another language: the requests ask in it, the screen shows it, and the choice is kept.
 *
 * The screen moves on the tap, because every word the app owns is already in the dictionary. The
 * shelf's words for a name, a description and a painter arrive with the next answer, and
 * `wordsPending` in `model/translatedText` says when they have not.
 */
export function setLocale(next: Locale): void {
  setRequested(next)
  setShown(next)
  applyDocumentLocale()
  try {
    localStorage.setItem(LOCALE_KEY, next)
  } catch {
    // The choice lives for this visit only.
  }
}

/** The stored choice, or null when the reader has never picked. */
export const storedLocale = (): Locale | null => readStored()
