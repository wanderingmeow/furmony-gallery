// src/data/listingCache.ts - the IndexedDB cache for listings.
//
// The `listings` store holds one row per adoptId, plus two records: `order` with the adoptIds in
// display order, which is the order the API sent, and `lang` with the code the API was asked in.
//
// Opening the database and running transactions lives in idb.ts. Fetching from the API lives
// in api.ts.
import type { AdoptListing } from '../model/types'
import { urlPath } from './image'
import { LISTINGS_STORE, LANG_KEY, ORDER_KEY, clearStore, readAll, replaceAll } from './idb'

/** The saved rows and the language they were answered in. */
export interface Cache {
  rows: AdoptListing[]
  lang: string
}

export async function readCache(): Promise<Cache | null> {
  try {
    const all = await readAll<number | string, AdoptListing | number[] | string>(LISTINGS_STORE)
    const byId = new Map<number, AdoptListing>()
    for (const [key, value] of all) {
      if (typeof key === 'number' && typeof value !== 'string' && !Array.isArray(value)) {
        byId.set(key, value)
      }
    }
    const order = all.get(ORDER_KEY)
    const rows = Array.isArray(order) && order.length > 0
      ? order.map((id) => byId.get(id)).filter((l): l is AdoptListing => !!l)
      : [...byId.values()]
    if (rows.length === 0) return null
    // A cache written before the language was recorded reads as the language the data is in.
    const lang = all.get(LANG_KEY)
    return { rows, lang: typeof lang === 'string' ? lang : 'zh' }
  } catch {
    return null
  }
}

/**
 * The saved rows, when they were answered in `lang`.
 *
 * The API writes names and descriptions in the language the request asked for, so a cache kept in
 * another language holds the wrong words. A cache that carries no language is treated the same way,
 * and the next save fills it in.
 */
export async function loadListings(lang: string): Promise<AdoptListing[] | null> {
  const cache = await readCache()
  return cache && cache.lang === lang ? cache.rows : null
}

export async function saveListings(listings: AdoptListing[], lang: string): Promise<void> {
  try {
    const entries: [string | number, unknown][] = listings.map((l) => [l.adoptId, l])
    entries.push([ORDER_KEY, listings.map((l) => l.adoptId)], [LANG_KEY, lang])
    await replaceAll(LISTINGS_STORE, entries)
  } catch { /* ignore */ }
}

export async function clearListings(): Promise<void> {
  try {
    await clearStore(LISTINGS_STORE)
  } catch { /* ignore */ }
}

// The waterfall keys each card by its listing object, so a row with the same content has to be
// handed back as the same object: a new object means a new card and a cover that decodes again.

// What the reader would see. Signed URLs are compared by path, so a new signature is the same
// image. Keys are sorted, because the order of the fields in the JSON is not something a reader
// can see. The order inside a list is visible: api.ts sorts the two lists that the API returns
// unordered, and a third one would rebuild every card.
function fingerprint(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(urlPath(value))
  if (Array.isArray(value)) return `[${value.map(fingerprint).join(',')}]`
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>
    return `{${Object.keys(row).sort()
      .map((k) => `${JSON.stringify(k)}:${fingerprint(row[k])}`).join(',')}}`
  }
  return value === undefined ? 'null' : JSON.stringify(value)
}

/** The fields the API answers in the language the request asked for. */
const TRANSLATED = ['adoptName', 'detailDescription']

/** The row as the API would answer it in any language: the picture, the money, the sizes. Two
 *  rows that share this hold everything a card draws besides words. */
function untranslated(row: AdoptListing): AdoptListing {
  const rest: Record<string, unknown> = { ...row }
  for (const key of TRANSLATED) delete rest[key]
  const painter = row.harmonyPainterVo
  if (painter) {
    const vo: Record<string, unknown> = { ...painter }
    delete vo.painterName
    rest.harmonyPainterVo = vo
  }
  return rest as unknown as AdoptListing
}

/**
 * Put the new rows in display order, and reuse an old row object whenever the new row holds the
 * same picture, the same money and the same sizes. A card is rebuilt when its row object changes,
 * and a rebuilt card reloads its picture, so this function copies the words the load translated
 * into the old object and keeps the object itself.
 *
 * `stillCurrent` gates every write below: a load the page no longer waits on touches neither the
 * rows on screen nor the saved copy.
 */
export async function mergeListings(
  old: AdoptListing[],
  newRows: AdoptListing[],
  lang: string,
  stillCurrent: () => boolean = () => true,
): Promise<{ updated: AdoptListing[]; changed: boolean }> {
  if (!stillCurrent()) return { updated: old, changed: false }
  const shape = (l: AdoptListing): string => fingerprint(untranslated(l))
  const byId = new Map(old.map((l) => [l.adoptId, { row: l, print: fingerprint(l), shape: shape(l) }]))
  let wordsMoved = false
  const updated = newRows.map((item) => {
    const prior = byId.get(item.adoptId)
    if (!prior) return item
    if (prior.shape !== shape(item)) return item
    // The new words land on the object this card already draws, so the picture stays put. The
    // screen reads them through model/translatedText, and the cache holds the row with them.
    if (prior.print !== fingerprint(item)) {
      Object.assign(prior.row, item)
      wordsMoved = true
    }
    return prior.row
  })
  // A row that kept its object is unchanged, so a new object here is a change. New words count too:
  // the cache holds them and carries their language.
  const changed =
    updated.length !== old.length || wordsMoved || updated.some((l, i) => l !== old[i])

  if (changed) {
    await saveListings(updated, lang)
  }

  return { updated, changed }
}
