import { afterEach, describe, expect, it } from 'vitest'
import { ENDPOINT_URL, LIST_REQUEST_INIT, listKey, pageUrl, type Endpoint } from './endpoints'
import { prefetchScript, takePrefetched } from './prefetch'

// The code runs with its own fetch and its own window, so nothing here reaches the site.
const run = (ask: (url: string, init: RequestInit) => Promise<Response>) =>
  new Function('fetch', 'window', prefetchScript())(ask, window)

const answered = (body: unknown): Response =>
  ({ ok: true, json: async () => body }) as unknown as Response

/** A site that answers the first page and then the whole list. */
const site = (total: number, rows: unknown[]) => (url: string) =>
  Promise.resolve(answered(url.includes('pageSize') ? { code: 200, total, rows } : { code: 200, total }))

const endpoints = Object.keys(ENDPOINT_URL) as Endpoint[]

// The document asks for both lists, so a test needs one list's addresses out of the script.
const ofList = (endpoint: Endpoint, urls: string[]) => urls.filter((u) => u.startsWith(ENDPOINT_URL[endpoint]))

afterEach(() => {
  delete window.__furmonyPrefetch
})

describe('the chain the document starts for itself', () => {
  it('keeps one per list, under the key of that list', () => {
    run(site(1, []))
    for (const endpoint of endpoints) expect(takePrefetched(listKey(endpoint))).toBeInstanceOf(Promise)
  })

  it('asks the second time for the total the first answer named', async () => {
    const asked: string[] = []
    run((url) => {
      asked.push(url)
      return site(7, [])(url)
    })
    await takePrefetched(listKey('primary'))
    const urls = ofList('primary', asked)
    expect(urls[0]).toBe(pageUrl('primary'))
    expect(new URL(urls[1]).searchParams.get('pageSize')).toBe('7')
  })

  it('asks the way api.ts asks', async () => {
    const seen: RequestInit[] = []
    run((_url, init) => {
      seen.push(init)
      return site(1, [])(_url)
    })
    await Promise.all(endpoints.map((endpoint) => takePrefetched(listKey(endpoint))))
    expect(seen).toHaveLength(4)
    for (const init of seen) expect(init).toEqual(LIST_REQUEST_INIT)
  })

  it('resolves to the whole list, not to the first page', async () => {
    run(site(2, ['a', 'b']))
    expect(await takePrefetched(listKey('primary'))).toEqual({ code: 200, total: 2, rows: ['a', 'b'] })
  })

  it('joins a chain that is still running', async () => {
    let answer!: (res: Response) => void
    const running = new Promise<Response>((res) => {
      answer = res
    })
    run(() => running)
    const chain = takePrefetched(listKey('primary'))!
    answer(answered({ code: 200, total: 3 }))
    expect(await chain).toEqual({ code: 200, total: 3 })
  })

  it('gives each chain to the first caller only', () => {
    run(site(1, []))
    const url = listKey('primary')
    expect(takePrefetched(url)).toBeInstanceOf(Promise)
    expect(takePrefetched(url)).toBeUndefined()
  })

  it('says nothing about a key the document did not file', () => {
    run(site(1, []))
    expect(takePrefetched('furmony:list:none')).toBeUndefined()
  })

  // The app reads null as no prefetch and asks in its own way, so a failure here costs nothing extra.
  it('answers null when the first request fails', async () => {
    const asked: string[] = []
    run((url) => {
      asked.push(url)
      return Promise.reject(new Error('offline'))
    })
    await expect(takePrefetched(listKey('primary'))).resolves.toBeNull()
    expect(ofList('primary', asked)).toEqual([pageUrl('primary')])
  })

  it('answers null when the answer is not ok', async () => {
    run(() => Promise.resolve({ ok: false, status: 418 } as Response))
    await expect(takePrefetched(listKey('series'))).resolves.toBeNull()
  })

  // A total that never arrives must not turn into a request for pageSize=undefined.
  it('answers null when the first answer is not the API saying 200', async () => {
    const asked: string[] = []
    run((url) => {
      asked.push(url)
      return Promise.resolve(answered({ code: 500, total: 9 }))
    })
    await expect(takePrefetched(listKey('primary'))).resolves.toBeNull()
    expect(ofList('primary', asked)).toEqual([pageUrl('primary')])
  })
})

describe('api.ts picks up what the document started', () => {
  it('paints both lists out of what the document brought back', async () => {
    run((url) =>
      Promise.resolve(
        answered(
          url.includes('pageSize')
            ? { code: 200, total: 1, rows: [{ adoptId: url.includes('productSeries') ? 2 : 1 }] }
            : { code: 200, total: 1 },
        ),
      ),
    )
    const { fetchAllListings } = await import('./api')
    expect((await fetchAllListings()).map((l) => l.adoptId)).toEqual([1, 2])
    for (const endpoint of endpoints) expect(takePrefetched(listKey(endpoint))).toBeUndefined()
  })
})
