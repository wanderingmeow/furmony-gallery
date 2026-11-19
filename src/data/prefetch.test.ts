import { afterEach, describe, expect, it } from 'vitest'
import { ENDPOINT_URL, LIST_PAGE_SIZE, listRequestInit, listKey, pageUrl, type Endpoint } from './endpoints'
import { prefetchScript, takePrefetched } from './prefetch'
import { API_LANGUAGE, LOCALE_KEY } from '../i18n/apiLanguage'
import { browserLocale } from '../i18n/locale'

// The code runs with its own fetch and its own window, so nothing here reaches the site.
const run = (ask: (url: string, init: RequestInit) => Promise<Response>) =>
  new Function('fetch', 'window', prefetchScript())(ask, window)

const answered = (body: unknown): Response =>
  ({ ok: true, json: async () => body }) as unknown as Response

const site = (total: number, rows: unknown[]) => (_url: string) =>
  Promise.resolve(answered({ code: 200, total, rows }))

const endpoints = Object.keys(ENDPOINT_URL) as Endpoint[]

/** The language one ask carried. */
const header = (init: RequestInit): string => (init.headers as Record<string, string>)['Target-Language']

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

  it('asks once, for a page wide enough to hold the shelf', async () => {
    const asked: string[] = []
    run((url) => {
      asked.push(url)
      return site(7, [])(url)
    })
    await takePrefetched(listKey('primary'))
    expect(ofList('primary', asked)).toEqual([pageUrl('primary', LIST_PAGE_SIZE)])
  })

  it('asks the way api.ts asks', async () => {
    localStorage.setItem(LOCALE_KEY, 'ja')
    const seen: RequestInit[] = []
    run((_url, init) => {
      seen.push(init)
      return site(1, [])(_url)
    })
    await Promise.all(endpoints.map((endpoint) => takePrefetched(listKey(endpoint))))
    // One request per list.
    expect(seen).toHaveLength(2)
    // The language sits in the header, so a page that opens in 日本語 does not fill the screen with
    // names from another language while the app waits for its own request.
    for (const init of seen) expect(init).toEqual(listRequestInit('pa'))
    localStorage.removeItem(LOCALE_KEY)
  })

  it('asks a first visit in the language the browser speaks', async () => {
    const seen: RequestInit[] = []
    run((_url, init) => {
      seen.push(init)
      return site(1, [])(_url)
    })
    await takePrefetched(listKey('primary'))
    expect(header(seen[0])).toBe(API_LANGUAGE[browserLocale()])
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
    expect(ofList('primary', asked)).toEqual([pageUrl('primary', LIST_PAGE_SIZE)])
  })

  it('answers null when the answer is not ok', async () => {
    run(() => Promise.resolve({ ok: false, status: 418 } as Response))
    await expect(takePrefetched(listKey('series'))).resolves.toBeNull()
  })

  // The API can report a failure inside a response that is ok, and the page a WAF sends back is
  // not JSON at all. Either way the app gets null, and it makes its own request.
  it('answers null when the first answer is not the API saying 200', async () => {
    const asked: string[] = []
    run((url) => {
      asked.push(url)
      return Promise.resolve(answered({ code: 500, total: 9 }))
    })
    await expect(takePrefetched(listKey('primary'))).resolves.toBeNull()
    expect(ofList('primary', asked)).toEqual([pageUrl('primary', LIST_PAGE_SIZE)])
  })
})

describe('api.ts picks up what the document started', () => {
  it('paints both lists out of what the document brought back', async () => {
    run((url) =>
      Promise.resolve(
        answered({ code: 200, total: 1, rows: [{ adoptId: url.includes('productSeries') ? 2 : 1 }] }),
      ),
    )
    const { fetchAllListings } = await import('./api')
    expect((await fetchAllListings()).map((l) => l.adoptId)).toEqual([1, 2])
    for (const endpoint of endpoints) expect(takePrefetched(listKey(endpoint))).toBeUndefined()
  })
})
