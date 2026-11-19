// The words the shelf translates, held apart from the rows they describe.
//
// The shelf answers `adoptName`, `detailDescription` and the painter's name in the language the
// request asked for, and every other field on a row means the same thing in every language. The
// waterfall keys each card by its row object, so replacing the rows to carry new words would rebuild
// every card and reload every picture.
//
// So the words live here. A row keeps its object across a change of language, the card stays where
// it is with its picture painted, and the accessors below read the language on screen.
import { createSignal } from 'solid-js'
import { locale, type Locale } from '../i18n/locale'
import type { AdoptListing } from './types'

export interface ListingWords {
  name?: string
  description?: string
  painter?: string
}

const [words, setWords] = createSignal(new Map<number, ListingWords>())
// The language those words were answered in, or null while the shelf has never been asked.
const [heldLanguage, setHeldLanguage] = createSignal<Locale | null>(null)

/**
 * The words the shelf answered for these rows, in the language `language`.
 *
 * The whole table is replaced at once, so a screen shows one language throughout, and never the
 * name from one visit beside the description from another.
 */
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

/**
 * True while the words on the rows belong to a language the screen no longer shows.
 *
 * A pick moves the screen right away, and the shelf's answer takes a moment. In that space a name
 * written in the language the reader just left would sit beside a tag in the new one, so the places
 * that show these fields put a placeholder there until the answer lands.
 */
export const wordsPending = () => {
  const held = heldLanguage()
  return held !== null && held !== locale()
}

const held = (listing: AdoptListing): ListingWords | undefined => words().get(listing.adoptId)

/** The name in the language on screen. A row the shelf was never asked about keeps its own. */
export const listingName = (listing: AdoptListing): string | undefined =>
  held(listing)?.name ?? listing.adoptName

/** The description in the language on screen. */
export const listingDescription = (listing: AdoptListing): string | undefined =>
  held(listing)?.description ?? listing.detailDescription

/** The painter as the shelf writes their name in the language on screen. */
export const listingPainterName = (listing: AdoptListing): string | undefined =>
  held(listing)?.painter ?? listing.harmonyPainterVo?.painterName
