import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  askPicture, askSettings, endpointUsable, parsePicture, parseResponse, pictureEndpoint,
} from './searchApi'

describe('parseResponse', () => {
  it('reads a reply', () => {
    expect(parseResponse({ ids: [2871, 1333], took_ms: 131 })?.ids).toEqual([2871, 1333])
  })

  it('returns nothing for a body without ids', () => {
    expect(parseResponse(null)).toBeNull()
    expect(parseResponse({})).toBeNull()
    expect(parseResponse({ ids: 'nope' })).toBeNull()
  })

  // A service mid-deploy may answer in a shape this build does not know. That has to look
  // like "no answer", not like a list of NaN.
  it('drops entries of the wrong type instead of trusting them', () => {
    expect(parseResponse({ ids: [1, 'two', 3] })?.ids).toEqual([1, 3])
    expect(parseResponse({ ids: [] })).toEqual({ ids: [] })
  })
})

describe('askSettings', () => {
  function spyFetch() {
    const urls: string[] = []
    vi.stubGlobal('fetch', (input: unknown) => {
      urls.push(String(input))
      return Promise.resolve(new Response(JSON.stringify({ ids: [1] })))
    })
    return urls
  }

  // The gate lives in the caller too, but a guard that only the polite caller honours is
  // not a guard.
  it.each(['1234567', '42', '12 34', '1234，5678'])('keeps %o off the network', async (query) => {
    const urls = spyFetch()
    expect(await askSettings(query, new AbortController().signal)).toBeNull()
    expect(urls).toEqual([])
  })

  it('keeps a query shorter than three characters off the network', async () => {
    const urls = spyFetch()
    expect(await askSettings('黑龙', new AbortController().signal)).toBeNull()
    expect(urls).toEqual([])
  })

  it('sends the sentence and nothing else', async () => {
    const urls = spyFetch()
    await askSettings('黑绿色的龙，不带翅膀', new AbortController().signal)
    expect(urls).toHaveLength(1)
    const params = new URL(urls[0]).searchParams
    expect(params.get('q')).toBe('黑绿色的龙，不带翅膀')
    expect([...params.keys()].sort()).toEqual(['k', 'q'])
  })

  // The cache lives in the module, so this case needs a fresh module rather than a public
  // reset that production would carry forever and nobody would ever press.
  it('asks the same sentence once', async () => {
    vi.resetModules()
    const { askSettings: ask } = await import('./searchApi')
    const urls = spyFetch()
    await ask('紫金的龙', new AbortController().signal)
    await ask('紫金的龙', new AbortController().signal)
    expect(urls).toHaveLength(1)
  })
})

describe('endpointUsable', () => {
  // An address that is not shaped right means "this build was never configured", not
  // "the service is broken".
  it('only believes the path it knows how to ask', () => {
    expect(endpointUsable('https://h.example/search')).toBe(true)
    expect(endpointUsable('https://h.example/api')).toBe(false)
    expect(endpointUsable('https://h.example')).toBe(false)
    expect(endpointUsable('http://h.example/search')).toBe(false)
    expect(endpointUsable('')).toBe(false)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })
})


describe('the picture endpoint', () => {
  // The injected address is the sentence endpoint, so the picture path has to be found
  // beside it rather than appended to it.
  it('is the sibling of the address the build was given', () => {
    expect(pictureEndpoint('https://h.example/search')).toBe('https://h.example/search-image')
    expect(pictureEndpoint('https://h.example/api')).toBe('https://h.example/api/search-image')
  })
})

describe('parsePicture', () => {
  it('reads the ids and where the subject sat', () => {
    expect(parsePicture({ ids: [201, 936], box: [0, 0.05, 0.99, 0.86] }))
      .toEqual({ ids: [201, 936], box: [0, 0.05, 0.99, 0.86] })
  })

  it('has no box when nothing was cut out', () => {
    expect(parsePicture({ ids: [1], box: null })?.box).toBeNull()
  })

  // A box drawn from a body this build does not know would put a frame around the wrong
  // part of somebody's photograph.
  it('keeps the reason beside an empty answer', () => {
    expect(parsePicture({ ids: [], box: null, error: 'too_large' })?.error).toBe('too_large')
  })

  it('says nothing extra when the answer is a good one', () => {
    expect(parsePicture({ ids: [1], box: null })?.error).toBeUndefined()
    expect(parsePicture({ ids: [1], box: null })?.action).toBeUndefined()
  })

  // The service sends the action; the page does not infer it from the spelling of the code.
  // Inferring it would offer the one move that cannot work the day a new reason appears.
  it('reads the action that comes with the reason', () => {
    expect(parsePicture({ ids: [], box: null, error: 'too_large', action: 'pick' })?.action)
      .toBe('pick')
    expect(parsePicture({ ids: [], box: null, error: 'embed_down', action: 'retry' })?.action)
      .toBe('retry')
  })

  it('invents no action for a word it has not heard', () => {
    expect(parsePicture({ ids: [], box: null, error: 'no_subject', action: 'shrug' })?.action)
      .toBeUndefined()
  })

  it('drops a box that is not four numbers', () => {
    expect(parsePicture({ ids: [1], box: [1, 2, 3] })?.box).toBeNull()
    expect(parsePicture({ ids: [1], box: ['a', 1, 1, 1] })?.box).toBeNull()
    expect(parsePicture({ ids: [1], box: [1, 2, 3, Number.NaN] })?.box).toBeNull()
  })
})

describe('askPicture', () => {
  // The picture goes over XMLHttpRequest, so the test stands in for that rather than for
  // fetch. What this request guarantees is two moments: the bytes leave, then the answer
  // comes. The fake has to be able to report them separately.
  class FakeXhr {
    static queue: FakeXhr[] = []
    static auto: { status: number; body: string } | null = { status: 200, body: '{"ids":[201],"box":null}' }
    method = ''
    url = ''
    headers: Record<string, string> = {}
    body: unknown = null
    status = 0
    responseText = ''
    private handlers = new Map<string, (() => void)[]>()
    private uploadHandlers = new Map<string, (() => void)[]>()
    upload = { addEventListener: (name: string, fn: () => void) => {
      this.uploadHandlers.set(name, [...(this.uploadHandlers.get(name) ?? []), fn])
    } }
    addEventListener(name: string, fn: () => void) {
      this.handlers.set(name, [...(this.handlers.get(name) ?? []), fn])
    }
    open(method: string, url: string) { this.method = method; this.url = url }
    setRequestHeader(name: string, value: string) { this.headers[name] = value }
    send(body: unknown) {
      this.body = body
      FakeXhr.queue.push(this)
      if (FakeXhr.auto) this.respond(FakeXhr.auto.status, FakeXhr.auto.body)
    }
    respond(status: number, body: string) {
      this.status = status; this.responseText = body; this.fire('load')
    }
    fire(name: string) { (this.handlers.get(name) ?? []).forEach((fn) => fn()) }
    uploaded() { (this.uploadHandlers.get('load') ?? []).forEach((fn) => fn()) }
    abort() { this.fire('abort') }
  }

  const picture = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })

  beforeEach(() => {
    FakeXhr.queue = []
    FakeXhr.auto = { status: 200, body: '{"ids":[201],"box":null}' }
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
  })

  const sent = () => FakeXhr.queue[0]

  it('posts the bytes with the subject cut out, which is not a choice here', async () => {
    const got = await askPicture(picture(), new AbortController().signal)
    expect(got?.ids).toEqual([201])
    expect(sent().method).toBe('POST')
    expect(sent().url).toContain('/search-image?')
    expect(new URL(sent().url).searchParams.get('cutout')).toBe('1')
    expect(sent().headers['content-type']).toBe('image/jpeg')
    expect(sent().body).toBeInstanceOf(Blob)
  })

  // The two waits are reported apart, so the transport has to say when the first one ends -
  // before the answer, and whether or not an answer ever comes.
  it('says when the picture has left the device', async () => {
    FakeXhr.auto = null
    const seen: string[] = []
    const going = askPicture(picture(), new AbortController().signal, () => seen.push('uploaded'))
    expect(seen).toEqual([])               // still on the wire
    sent().uploaded()
    expect(seen).toEqual(['uploaded'])
    sent().respond(200, '{"ids":[201],"box":null}')
    expect(await going).toEqual({ ids: [201], box: null })
    expect(seen).toEqual(['uploaded'])     // the answer does not repeat it
  })

  // The reader is waiting for a slot, not for a fix. Retrying straight away walks into the
  // same refusal, so the two answers cannot be the same word.
  it('says busy apart from failing', async () => {
    FakeXhr.auto = { status: 429, body: '{"error":"busy","ids":[]}' }
    expect(await askPicture(picture(), new AbortController().signal))
      .toEqual({ ids: [], box: null, busy: true })
  })

  // The reader is told why, so the word has to survive the trip. Without it every failure
  // looks alike and 重试 becomes a guess.
  it('carries the reason the service gave', async () => {
    FakeXhr.auto = { status: 502, body: '{"error":"embed_down","ids":[]}' }
    expect((await askPicture(picture(), new AbortController().signal))?.error).toBe('embed_down')
  })

  it('names an answer that is not an answer', async () => {
    FakeXhr.auto = { status: 200, body: 'not json' }
    expect((await askPicture(picture(), new AbortController().signal))?.error).toBe('unknown')
  })

  it('names a connection that never carried the picture', async () => {
    FakeXhr.auto = null
    const going = askPicture(picture(), new AbortController().signal)
    sent().fire('error')
    expect((await going)?.error).toBe('network')
  })

  // The reader stopping is not a failure to explain, and only the store can tell the clock
  // apart from the reader.
  it('says nothing when the reader stopped asking', async () => {
    FakeXhr.auto = null
    const ctrl = new AbortController()
    const going = askPicture(picture(), ctrl.signal)
    ctrl.abort()
    expect(await going).toBeNull()
  })
})

/** The module keeps one flag for the whole page — that is the point of it — so each test here
 *  needs its own copy of the module rather than a shared one it might arrive late to. */
async function freshApi() {
  vi.resetModules()
  return import('./searchApi')
}

describe('warmSearch', () => {
  it('makes one small request the first time the reader shows interest, and never again', async () => {
    const { warmSearch, SEARCH_ENDPOINT } = await freshApi()
    const seen: { url: string; mode?: string }[] = []
    vi.stubGlobal('fetch', (input: unknown, init?: RequestInit) => {
      seen.push({ url: String(input), mode: init?.mode })
      return Promise.resolve(new Response('{}'))
    })

    warmSearch()
    warmSearch()

    expect(seen).toHaveLength(1)
    expect(seen[0].url.startsWith(SEARCH_ENDPOINT)).toBe(true)
    // Opaque on purpose: the answer is thrown away, only the live connection is wanted.
    expect(seen[0].mode).toBe('no-cors')
    // One character: the service refuses this before it looks at anything, so no model runs.
    expect(seen[0].url).toContain('q=.')
    vi.unstubAllGlobals()
  })

  it('treats a warm-up that cannot connect as one that simply did not happen', async () => {
    const { warmSearch } = await freshApi()
    let called = 0
    vi.stubGlobal('fetch', () => {
      called++
      return Promise.reject(new TypeError('Failed to fetch'))
    })

    expect(() => warmSearch()).not.toThrow()
    await Promise.resolve()

    expect(called).toBe(1)
    vi.unstubAllGlobals()
  })
})
