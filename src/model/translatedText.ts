// The words the API translates, held apart from the rows they describe.
//
// The waterfall keys each card by its row object, so handing the screen new rows to carry new words
// would rebuild every card and reload every picture. The words live here instead: a row keeps its
// object across a change of language, and the accessors below read the language on screen.
import { createSignal } from 'solid-js'
import { locale, requestedLocale, type Locale } from '../i18n/locale'
import type { AdoptListing } from './types'

export interface ListingWords {
  name?: string
  description?: string
  painter?: string
}

const [words, setWords] = createSignal(new Map<number, ListingWords>())
// The language those words were answered in, or null while the API has never been asked.
const [heldLanguage, setHeldLanguage] = createSignal<Locale | null>(null)

/** The words the API answered for these rows, in the language `language`. The table is replaced
 *  whole, so one screen never shows a name from one answer beside a description from another. */
export function rememberWords(rows: AdoptListing[], language: Locale): void {
  const next = new Map<number, ListingWords>()
  for (const row of rows) {
    next.set(row.adoptId, {
      name: row.adoptName,
      description: row.detailDescription,
      painter: row.harmonyPainterVo?.painterName,
    })
  }
  setWords(next)
  setHeldLanguage(language)
}

/** True while the words on the rows belong to a language the screen no longer shows: a pick moves
 *  the screen at once, and the answer takes a moment. */
export const wordsPending = () => {
  const held = heldLanguage()
  return held !== null && held !== locale()
}

const held = (listing: AdoptListing): ListingWords | undefined => words().get(listing.adoptId)

/** The name in the language on screen. A row the API was never asked about keeps its own. */
export const listingName = (listing: AdoptListing): string | undefined =>
  held(listing)?.name ?? listing.adoptName

/** The description in the language on screen. */
export const listingDescription = (listing: AdoptListing): string | undefined =>
  held(listing)?.description ?? listing.detailDescription

/** The API answers a Japanese painter name as a sentence about who they are - 謎の組織です - and a
 *  card shows a name. No name uses です anywhere but at the end. */
const dropCopula = (name: string | undefined): string | undefined => name?.replace(/です$/, '')

/** The painter as the API writes their name in the language on screen. */
export const listingPainterName = (listing: AdoptListing): string | undefined => {
  const name = held(listing)?.painter ?? listing.harmonyPainterVo?.painterName
  const written = heldLanguage() ?? requestedLocale()
  return written === 'ja' ? dropCopula(name) : name
}
