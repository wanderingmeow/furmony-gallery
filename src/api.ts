// src/api.ts — network layer only. All caching lives in cache.ts.

import type { AdoptListing, AdoptListResponse } from './types'

const BASE_URL = 'https://apo.furmony.com/adopt/HarmonyAdopt/entrustAdopt/list'

// No custom headers: let the browser generate them (Accept/User-Agent/Sec-Fetch-*).
// Ported from Swift FurmonyAPI.fetchPage(pageSize:pageNum:) + ListingFetcher.fetchAllListings:
// API design requires two calls — first WITHOUT pageSize to get `total`, then
// pageSize=total to fetch everything in one page.
async function fetchPage(pageSize?: number, pageNum = 1): Promise<AdoptListResponse> {
  const qs = new URLSearchParams({ pageNum: String(pageNum) })
  if (pageSize !== undefined) qs.set('pageSize', String(pageSize))
  const url = `${BASE_URL}?${qs.toString()}`
  const res = await fetch(url, { referrerPolicy: 'no-referrer' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data: AdoptListResponse = await res.json()
  if (data.code !== 200) throw new Error(`API code ${data.code}`)
  return data
}

// Dev-only mock: the official API is fetched ONCE into listings_sample.json
// (image URLs replaced with an empty base64 PNG) so dev/test never hammers the
// live API. Release builds keep the live fetch — `import.meta.env.DEV` is
// statically `false` in production, so Rollup drops this branch (and the mock
// chunk) from the shipped bundle.
export async function fetchAllListings(): Promise<AdoptListing[]> {
  if (import.meta.env.DEV) {
    const mockFiles = import.meta.glob<{ default: any }>('../agent/listings_sample.json')
    const mockLoader = mockFiles['../agent/listings_sample.json']
    if (mockLoader) {
      const { default: mock } = await mockLoader()
      return mock.rows as unknown as AdoptListing[]
    }
  }
  const firstPage = await fetchPage(undefined, 1)
  const total = firstPage.total
  const allPage = await fetchPage(total, 1)
  return allPage.rows
}

// Retry with fallback: attempts up to 3 times before giving up.
export async function fetchWithRetry(attempts = 3): Promise<AdoptListing[]> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchAllListings()
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}
