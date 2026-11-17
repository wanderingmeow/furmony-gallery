// src/data/api.ts - fetching only. The local cache lives in listingCache.ts.
import type { AdoptListing, AdoptListResponse } from '../model/types'
import { LIST_REQUEST_INIT, listKey, pageUrl, type Endpoint } from './endpoints'
import { takePrefetched } from './prefetch'
import { urlPath } from './image'

// No timeout: it would have to fit the slowest download, so shorter aborts loads that were about to succeed.
// No retry delay either: this API has never rate-limited us.
const ATTEMPTS_PER_LIST = 3

// Dev/tests read saved copies from agent/*.json instead of the live site. Kept at this
// bottom layer so retrying and merging behave the same in dev as in production; the bundler
// strips the whole branch (and the copies) from release builds.
async function fetchPage(endpoint: Endpoint, pageSize?: number, pageNum = 1): Promise<AdoptListResponse> {
  const url = pageUrl(endpoint, pageSize, pageNum)

  if (import.meta.env.DEV) {
    const mockPath = endpoint === 'primary' ? '../../agent/listings_sample.json' : '../../agent/series_sample.json'
    const mockFiles = import.meta.glob<{ default: any }>([
      '../../agent/listings_sample.json',
      '../../agent/series_sample.json',
    ])
    const loadMock = (mockFiles as Record<string, (() => Promise<{ default: unknown }>) | undefined>)[mockPath]
    if (loadMock) return (await loadMock()).default as AdoptListResponse
  }

  const res = await fetch(url, LIST_REQUEST_INIT)
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

// The API sends only 10 rows unless pageSize is given: ask once for `total`, then again with
// pageSize=total.
async function fetchList(endpoint: Endpoint): Promise<AdoptListing[]> {
  // The document can start this chain before the app exists, so the answer may already be running.
  const whole = (await takePrefetched(listKey(endpoint))) as AdoptListResponse | null | undefined
  if (whole?.code === 200 && Array.isArray(whole.rows)) return whole.rows.map(sortColorsAndPictures)

  const { total } = await fetchPage(endpoint)
  const { rows } = await fetchPage(endpoint, total)
  return rows.map(sortColorsAndPictures)
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
