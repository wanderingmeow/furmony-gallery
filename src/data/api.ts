// src/data/api.ts - fetching only. The local cache lives in listingCache.ts.
import type { AdoptListing, AdoptListResponse } from '../model/types'

// `series` is the site's 「新作登场」 list; its rows never appear in the main list
// (evidence: agent/furmony-api-notes.md §7).
type Endpoint = 'primary' | 'series'

const ENDPOINT_URL: Record<Endpoint, string> = {
  primary: 'https://apo.furmony.com/adopt/HarmonyAdopt/entrustAdopt/list',
  series: 'https://apo.furmony.com/adopt/HarmonyAdopt/productSeries/list',
}

// No timeout: it would have to fit the slowest download, so shorter aborts loads that were about to succeed.
// No retry delay either: this API has never rate-limited us.
const ATTEMPTS_PER_LIST = 3

// Dev/tests read saved copies from agent/*.json instead of the live site. Kept at this
// bottom layer so retrying and merging behave the same in dev as in production; the bundler
// strips the whole branch (and the copies) from release builds.
async function fetchPage(endpoint: Endpoint, pageSize?: number, pageNum = 1): Promise<AdoptListResponse> {
  if (import.meta.env.DEV) {
    const mockPath = endpoint === 'primary' ? '../../agent/listings_sample.json' : '../../agent/series_sample.json'
    const mockFiles = import.meta.glob<{ default: any }>([
      '../../agent/listings_sample.json',
      '../../agent/series_sample.json',
    ])
    const loadMock = (mockFiles as Record<string, (() => Promise<{ default: unknown }>) | undefined>)[mockPath]
    if (loadMock) return (await loadMock()).default as AdoptListResponse
  }

  const qs = new URLSearchParams({ pageNum: String(pageNum) })
  if (pageSize !== undefined) qs.set('pageSize', String(pageSize))
  const url = `${ENDPOINT_URL[endpoint]}?${qs.toString()}`
  const res = await fetch(url, { referrerPolicy: 'no-referrer' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data: AdoptListResponse = await res.json()
  if (data.code !== 200) throw new Error(`API code ${data.code}`)
  return data
}

// The API sends only 10 rows unless pageSize is given: ask once for `total`, then again with
// pageSize=total.
async function fetchList(endpoint: Endpoint): Promise<AdoptListing[]> {
  const { total } = await fetchPage(endpoint)
  const { rows } = await fetchPage(endpoint, total)
  return rows
}

async function withRetry<T>(attempts: number, load: () => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await load()
    } catch (e) {
      lastErr = e
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
export async function fetchAllListings(attempts = ATTEMPTS_PER_LIST): Promise<AdoptListing[]> {
  const seriesPromise = withRetry(attempts, () => fetchList('series')).catch((e) => {
    console.warn('[api] 新作登场列表拉取失败，本次不并入', e)
    return [] as AdoptListing[]
  })
  const mainRows = await withRetry(attempts, () => fetchList('primary'))
  return addDebutRows(mainRows, await seriesPromise)
}
