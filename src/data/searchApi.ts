// src/data/searchApi.ts - the Beta search calls: one for a sentence, one for a picture.
// Failures resolve to null rather than throwing, so the local search keeps working alone.

// Set at build time. Missing means the feature is off, not broken.
const ENCODED = String(import.meta.env.VITE_SEARCH_URL_B64 ?? '')

function decode(value: string): string {
  try {
    // A truncated or mistyped value must mean "not configured", not a broken fetch.
    return atob(value.trim())
  } catch {
    return ''
  }
}

export const SEARCH_ENDPOINT = decode(ENCODED).replace(/\/+$/, '')

// The two paths, written down once: the build is handed the sentence one.
const PATH = { text: '/search', image: '/search-image' } as const

/** https, a host with a dot in it, and the path this file can call.
 *
 *  The path check stops a wrongly pasted address from looking like a broken service: without
 *  it the reader sees a 404 and a search that is down, when this build was never configured.
 */
export function endpointUsable(url: string): boolean {
  return /^https:\/\/[^/.]+\.[^/]+/.test(url) && url.endsWith(PATH.text)
}

export const searchConfigured = endpointUsable(SEARCH_ENDPOINT)

// Ten seconds: about where a reader stops waiting and decides the page is dead. The answer
// takes about 50ms (p95 86ms), so the budget is the trip there. Each keystroke aborts the
// request before it, so this covers only the sentence the reader is waiting on.
export const SEARCH_TIMEOUT_MS = 10000
// 24 leaves room for the app's own filters after the hits are merged into the list.
const WANT = 24

// Ids only: a misread sentence shows up in the ranking, and echoing it back would change
// nothing about that.
export interface SemanticResult {
  ids: number[]
}

/** Digits and nothing but separators: `12 34`, `1234,5678`. A pile of numbers gives the model
 *  nothing to rank. */
const ONLY_NUMBERS = /^[\d\s,，、/.；;.-]+$/

/** Three characters or more, and not a pile of numbers: the local search matches an adoptId
 *  exactly, so that part is its job. Length counts code points, not UTF-16 units. */
export function worthAsking(query: string): boolean {
  const q = query.trim()
  return Array.from(q).length >= 3 && !ONLY_NUMBERS.test(q)
}

// The grid re-renders on tab and filter changes, each of which would otherwise re-ask.
// In memory only: nothing about a query reaches storage. Oldest entry goes first.
const CACHE_MAX = 60
const cache = new Map<string, SemanticResult>()

/** A service that is mid-deploy must look like "no answer", not like a broken list. */
export function parseResponse(body: unknown): SemanticResult | null {
  const ids = (body as { ids?: unknown } | null)?.ids
  if (!Array.isArray(ids)) return null
  return { ids: ids.filter((x): x is number => typeof x === 'number') }
}

export async function askSettings(query: string, signal: AbortSignal): Promise<SemanticResult | null> {
  // Checked here too, so no future caller can send one: a bare number is an adoptId, which
  // the local search matches exactly and the model can only guess at.
  if (!searchConfigured || !worthAsking(query)) return null
  const q = query.trim()
  const cached = cache.get(q)
  if (cached) return cached
  try {
    const res = await fetch(`${SEARCH_ENDPOINT}?${new URLSearchParams({ q, k: String(WANT) })}`, { signal })
    if (!res.ok) return null
    const parsed = parseResponse(await res.json())
    if (!parsed) return null
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
    cache.set(q, parsed)
    return parsed
  } catch {
    // Aborted or unreachable: the local matches stand on their own.
    return null
  }
}

// ---------- search by picture ----------

/** The picture path beside the address this build was given. The base already lost any
 *  trailing slash, so there is no `//` to allow for. */
export function pictureEndpoint(base: string): string {
  return base.endsWith(PATH.text)
    ? `${base.slice(0, -PATH.text.length)}${PATH.image}`
    : `${base}${PATH.image}`
}

export const PICTURE_ENDPOINT = pictureEndpoint(SEARCH_ENDPOINT)

// ---------- warming the connection ----------

// Where the service lives, the handshake is the wait: measured 3.7-12s before the edge answers
// a ClientHello, against ~50ms for the search itself. A browser keeps one connection per
// origin for the whole session, so one small request when the reader shows interest takes that
// handshake out of every wait they can see.
let warmed = false

/** One character, which the service rejects before running any model: it uses one of the twenty
 *  sentences a minute it allows and leaves a live connection behind. `no-cors` keeps the answer
 *  opaque.
 *
 *  The rejection arrives as a 400, which the browser logs as a failed resource. There is no
 *  anonymous 2xx to aim at instead - /healthz answers 404 to anyone but the operator, on
 *  purpose - so a warm connection and a quiet console are not both available today. Do not
 *  "fix" this by sending a query the service has to work on.
 */
export function warmSearch(): void {
  if (warmed || !searchConfigured || typeof fetch !== 'function') return
  warmed = true
  fetch(`${SEARCH_ENDPOINT}?${new URLSearchParams({ q: '.', k: '1' })}`, { mode: 'no-cors', cache: 'no-store' })
    .catch(() => {})
}

/** Twenty-five seconds, where a sentence gets ten. The service takes one upload at a time, so
 *  the wait is the queue in front plus the 3.5s embedding, and the reader chose the file. */
export const PICTURE_TIMEOUT_MS = 25000

/** Why the reader's own device never produced a picture to send. These are the words this
 *  build speaks for itself; the service's refusals arrive as free text over the wire and stay
 *  outside the union, because typing them would promise what the wire does not guarantee. */
export type LocalReason = 'unreadable' | 'noHevc' | 'timeout'

/** Every reason the page keeps a sentence for: the local ones, and the refusals the service
 *  sends by name. A reason missing from `WHY` is a compile error, not a vaguer message. */
export type PictureError =
  LocalReason | 'not_an_image' | 'too_large' | 'embed_down' | 'network' | 'unknown'

export interface PictureResult {
  ids: number[]
  /** Where the subject sat, as fractions of the picture that was sent: left, top, width,
   *  height. Null when nothing was cut out, which is also when there is no region to show. */
  box: [number, number, number, number] | null
  /** The service refused a second upload because one was already in flight. Not a failure:
   *  trying again at once hits the same refusal. */
  busy?: boolean
  /** Why there is no answer, in the service's own word: `not_an_image`, `too_large`,
   *  `embed_down`, or one of the two the browser reports. */
  error?: string
  /** What to do next. The service sets it for its own refusals, this file for the browser's.
   *  Absent means no button. */
  action?: 'pick' | 'retry'
}

export function parsePicture(body: unknown): PictureResult | null {
  const got = body as { ids?: unknown; box?: unknown; error?: unknown; action?: unknown } | null
  if (!Array.isArray(got?.ids)) return null
  const box = got.box
  const usable = Array.isArray(box) && box.length === 4
    && box.every((n) => typeof n === 'number' && Number.isFinite(n))
  return {
    ids: got.ids.filter((x): x is number => typeof x === 'number'),
    box: usable ? box as [number, number, number, number] : null,
    ...(typeof got.error === 'string' ? { error: got.error } : {}),
    // The service sends this. Guessing it from `error` would be wrong as soon as a new
    // reason appears.
    ...(got.action === 'pick' || got.action === 'retry' ? { action: got.action } : {}),
  }
}

/** Which settings look like this picture. The bytes are the body, not a form field, and
 *  `cutout` is always on: a design sheet loses nothing, and a photograph only finds its own
 *  design once the background is gone.
 *
 *  Never cached, unlike a sentence: two people's photographs are not the same question.
 *
 *  XHR because fetch reports the answer and nothing else. Uploading and searching are two
 *  waits of very different lengths, and on a hall's wifi the first is the slow one.
 */
export async function askPicture(
  picture: Blob, signal: AbortSignal, onUploaded?: () => void,
): Promise<PictureResult | null> {
  if (!searchConfigured || signal.aborted) return null
  const query = new URLSearchParams({ cutout: '1', k: String(WANT) })
  return await new Promise<PictureResult | null>((done) => {
    const xhr = new XMLHttpRequest()
    const stop = () => xhr.abort()
    const finish = (result: PictureResult | null) => {
      signal.removeEventListener('abort', stop)
      done(result)
    }
    signal.addEventListener('abort', stop)
    xhr.upload.addEventListener('load', () => onUploaded?.())
    xhr.open('POST', `${PICTURE_ENDPOINT}?${query}`)
    xhr.responseType = 'text'
    xhr.setRequestHeader('content-type', picture.type || 'image/jpeg')
    xhr.addEventListener('load', () => {
      // 429 is an answer, not a failure: the reader is waiting for a slot.
      if (xhr.status === 429) return finish({ ids: [], box: null, busy: true })
      let body: unknown = null
      try { body = JSON.parse(xhr.responseText) } catch { body = null }
      // With no reason from the service every failure looks the same, so it gets no action.
      finish(parsePicture(body) ?? { ids: [], box: null, error: 'unknown' })
    })
    // A browser-level failure: only this file can say what happened, because the service
    // never answered.
    xhr.addEventListener('error', () => finish({ ids: [], box: null, error: 'network', action: 'retry' }))
    // The timeout and the reader both end here. Only the store can tell them apart.
    xhr.addEventListener('abort', () => finish(null))
    xhr.send(picture)
  })
}
