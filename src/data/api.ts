// src/data/api.ts - fetching only. The local cache lives in listingCache.ts.
import type { AdoptListing, AdoptListResponse } from '../model/types'
import { LIST_PAGE_SIZE, listRequestInit, listKey, pageUrl, type Endpoint } from './endpoints'
import { apiLanguage } from '../i18n/locale'
import { takePrefetched } from './prefetch'
import { urlPath } from './image'

// No timeout: it would have to fit the slowest download, so shorter aborts loads that were about to succeed.
const ATTEMPTS_PER_LIST = 3

// The WAF in front of the site sometimes gets between the app and the API and returns a challenge
// page with no CORS header. The challenge clears on its own, so a retry that fires immediately
// gets the same page back. The second attempt starts after 400ms, and the third after 1200ms.
const RETRY_WAIT_MS = [400, 1200]

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// Dev/tests read saved copies from agent/*.json instead of the live site. Kept at this
// bottom layer so retrying and merging behave the same in dev as in production; the bundler
// strips the whole branch (and the copies) from release builds.
async function fetchPage(
  endpoint: Endpoint,
  lang: string,
  pageSize?: number,
  pageNum = 1,
  signal?: AbortSignal,
): Promise<AdoptListResponse> {
  const url = pageUrl(endpoint, pageSize, pageNum)

  if (import.meta.env.DEV) {
    // The archive is kept once per language the API can answer in, so a language switch has
    // something to land on with no network in the way. The file picked is the language this
    // request was asked in. Chinese is the plain name, and the tests read that name too.
    const base = endpoint === 'primary' ? 'listings_sample' : 'series_sample'
    const mockPath = `../../agent/${base}${lang === 'zh' ? '' : `.${lang}`}.json`
    const mockFiles = import.meta.glob<{ default: any }>([
      '../../agent/listings_sample.json',
      '../../agent/listings_sample.*.json',
      '../../agent/series_sample.json',
      '../../agent/series_sample.*.json',
    ])
    const loadMock = (mockFiles as Record<string, (() => Promise<{ default: unknown }>) | undefined>)[mockPath]
    if (loadMock) {
      // A copy: the imported JSON is one object shared by every request, and a merge writes new
      // words into the rows it holds.
      return structuredClone((await loadMock()).default) as AdoptListResponse
    }
  }

  const res = await fetch(url, { ...listRequestInit(lang), signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data: AdoptListResponse = await res.json()
  if (data.code !== 200) throw new Error(`API code ${data.code}`)
  return data
}

function byKey<T>(key: (v: T) => number | string) {
  return (a: T, b: T) => {
    const x = key(a)
    const y = key(b)
    return x < y ? -1 : x > y ? 1 : 0
  }
}

// The API gives the color list and the picture list no fixed order, so one listing can come
// back as [红, 蓝] and, on the next request, as [蓝, 红]. The chips and the gallery would
// shuffle on every visit, and the merge would treat every row as new.
export function sortColorsAndPictures(row: AdoptListing): AdoptListing {
  const colors = row.harmonyAdoptColorVos
  if (colors) row.harmonyAdoptColorVos = [...colors].sort(byKey((c) => c.colorId ?? 0))
  const details = row.harmonyAdoptDetails
  if (details) row.harmonyAdoptDetails = [...details].sort(byKey((d) => urlPath(d.detailPicture ?? '')))
  return row
}

/** The pages that a response leaves out. */
export function missingPages(total: number, pageSize = LIST_PAGE_SIZE): number[] {
  const pages: number[] = []
  for (let pageNum = 2; (pageNum - 1) * pageSize < total; pageNum++) pages.push(pageNum)
  return pages
}

// The API sends only 10 rows unless the request sets pageSize, so every request states its size.
// `lang` runs through a whole load: pages the reader scrolls side by side have to be in one language.
async function fetchList(endpoint: Endpoint, lang: string, signal?: AbortSignal): Promise<AdoptListing[]> {
  // The document can start this request before the app exists, so the answer can already be in
  // flight here.
  const started = (await takePrefetched(listKey(endpoint))) as AdoptListResponse | null | undefined
  const first =
    started?.code === 200 && Array.isArray(started.rows)
      ? started
      : await fetchPage(endpoint, lang, LIST_PAGE_SIZE, 1, signal)
  const pages = [first]
  for (const pageNum of missingPages(first.total)) {
    pages.push(await fetchPage(endpoint, lang, LIST_PAGE_SIZE, pageNum, signal))
  }
  return pages.flatMap((page) => page.rows).map(sortColorsAndPictures)
}

export async function withRetry<T>(
  attempts: number,
  load: (signal?: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(RETRY_WAIT_MS[Math.min(i - 1, RETRY_WAIT_MS.length - 1)])
    try {
      return await load(signal)
    } catch (e) {
      lastErr = e
      // Retrying an aborted request only fails the same way again.
      if (signal?.aborted) throw e
    }
  }
  throw lastErr
}

// Main row wins if the two lists ever overlap: the main list is what the site keeps updated.
function addDebutRows(mainRows: AdoptListing[], debutRows: AdoptListing[]): AdoptListing[] {
  const mainIds = new Set(mainRows.map((l) => l.adoptId))
  return [...mainRows, ...debutRows.filter((l) => !mainIds.has(l.adoptId))]
}

// A failing debut list is swallowed: a few rows aren't worth breaking the page for. Throwing
// when the main list fails is deliberate - loadData() keeps the cached copy, so
// saveListings() (clear + rewrite) never sees a half-complete list.
export async function fetchAllListings(
  attempts = ATTEMPTS_PER_LIST,
  signal?: AbortSignal,
  lang = apiLanguage(),
): Promise<AdoptListing[]> {
  const seriesPromise = withRetry(attempts, (s) => fetchList('series', lang, s), signal).catch((e) => {
    console.warn('[api] new-works list failed; skipped for this merge', e)
    return [] as AdoptListing[]
  })
  const mainRows = await withRetry(attempts, (s) => fetchList('primary', lang, s), signal)
  return addDebutRows(mainRows, await seriesPromise)
}
