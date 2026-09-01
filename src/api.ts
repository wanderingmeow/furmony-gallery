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

// Step 1: default call (no pageSize) → total + first page.
// Step 2: pageSize = total → all rows in one response.
// (If the backend ever caps pageSize and returns rows < total, we'd switch to
//  pagination — kept out per Swift's current implementation.)
export async function fetchAllListings(): Promise<AdoptListing[]> {
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
