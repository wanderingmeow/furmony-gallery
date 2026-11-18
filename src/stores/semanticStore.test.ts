import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PICTURE_TIMEOUT_MS, SEARCH_TIMEOUT_MS } from '../data/searchApi'
import { setSemanticSearch } from './displayStore'
import { setSearchText } from './filterStore'

// The fake answers only when the store aborts it, which is what a timeout does to a real fetch:
// the request ends with nothing in hand. That keeps the test about cancellation rather than about
// a reply's shape.
const asked = vi.hoisted(() => [] as AbortSignal[])

// Pictures answer when a test says they do, and end when the store aborts them - which is
// exactly what the real fetch does, and the abort is half of what this store is for.
const sent = vi.hoisted(() => ({
  signals: [] as AbortSignal[],
  answer: null as unknown,
  uploaded: null as (() => void) | null,
  // A sentence the service answers when a test says it does. Null stands for the reply that
  // never lands.
  textAnswer: null as Promise<unknown> | null,
  // A file the browser itself cannot read: prepare() hands back null.
  unreadable: false,
  // Re-encoding a picture takes a moment on a phone. A test can hold that moment open to see
  // what the reader has on screen while it lasts.
  encodeGate: null as Promise<void> | null,
}))

vi.mock('../data/searchApi', async (importOriginal) => {
  const real = await importOriginal<typeof import('../data/searchApi')>()
  return {
    ...real,
    searchConfigured: true,
    askSettings: (_q: string, signal: AbortSignal) => {
      asked.push(signal)
      return new Promise((resolve) => {
        signal.addEventListener('abort', () => resolve(null))
        void sent.textAnswer?.then(resolve)
      })
    },
    askPicture: (_blob: Blob, signal: AbortSignal, onUploaded?: () => void) => new Promise((resolve) => {
      sent.signals.push(signal)
      sent.uploaded = onUploaded ?? null
      signal.addEventListener('abort', () => resolve(null))
      void (sent.answer as Promise<unknown> | null)?.then(resolve)
    }),
  }
})

// The canvas work belongs to the browser. The store is under test, and all it needs is for
// the bytes to come back the other side of prepare().
vi.mock('../data/pictureInput', () => ({
  prepare: async (file: Blob) => {
    if (sent.encodeGate) await sent.encodeGate
    return sent.unreadable ? { blob: null, reason: 'unreadable' } : { blob: file }
  },
}))

const { picture, semanticActive, route, semanticPending, askFailure, retryAsk } =
  await import('./semanticStore')

/** The ids the list ranks by, whoever ranks it. */
const ids = (): number[] => {
  const r = route()
  return r.by === 'none' ? [] : r.ids
}

/** Reads the wait itself: the state label translates it into other words. */
const pictureWaitingNow = () => picture.state() === 'searching'

/** Solid runs queued effects at the end of the update, not inside the setter, and the queue
 *  drains over more than one microtask - a macrotask boundary is what it settles by. */
function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  asked.length = 0
  sent.signals.length = 0
  sent.answer = null
  sent.textAnswer = null
  sent.unreadable = false
  sent.encodeGate = null
  picture.close()
  setSemanticSearch(true)
  setSearchText('')
})

describe('the semantic request lifecycle', () => {
  it('asks once the query is worth asking', async () => {
    setSearchText('黑绿色的龙')
    await settled()
    expect(asked).toHaveLength(1)
    expect(asked[0].aborted).toBe(false)
    expect(semanticPending()).toBe(true)
  })

  it('aborts the request a new query supersedes', async () => {
    setSearchText('黑绿色的龙')
    await settled()
    setSearchText('黑绿色的龙，不带翅膀')
    await settled()
    expect(asked).toHaveLength(2)
    expect(asked[0].aborted).toBe(true)
    expect(asked[1].aborted).toBe(false)
  })

  it('aborts when the query stops being worth asking', async () => {
    setSearchText('黑绿色的龙')
    await settled()
    setSearchText('黑龙')
    await settled()
    expect(asked[0].aborted).toBe(true)
    expect(semanticPending()).toBe(false)
  })

  it('aborts when the switch goes off', async () => {
    setSearchText('黑绿色的龙')
    await settled()
    setSemanticSearch(false)
    await settled()
    expect(asked[0].aborted).toBe(true)
    expect(semanticPending()).toBe(false)
  })

  it('aborts when the sentence is cleared', async () => {
    setSearchText('黑绿色的龙')
    await settled()
    setSearchText('')
    expect(asked[0].aborted).toBe(true)
    expect(semanticPending()).toBe(false)
  })

  it('records that the sentence in the box got no answer', async () => {
    vi.useFakeTimers()
    setSearchText('机械狼')
    await vi.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS)
    expect(askFailure()).toBe(true)
    vi.useRealTimers()
  })

  it('lets a failure expire once the box holds another sentence', async () => {
    vi.useFakeTimers()
    setSearchText('机械狼')
    await vi.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS)
    expect(askFailure()).toBe(true)
    // A bare number belongs to the local search, so no request goes out and the old failure
    // stays on record. It still says nothing about this search.
    setSearchText('12')
    await vi.advanceTimersByTimeAsync(0)
    expect(askFailure()).toBe(false)
    vi.useRealTimers()
  })

  it('clears the failure once the sentence is answered', async () => {
    vi.useFakeTimers()
    setSearchText('机械狼')
    await vi.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS)
    expect(askFailure()).toBe(true)
    sent.textAnswer = Promise.resolve({ ids: [7] })
    retryAsk()
    await vi.advanceTimersByTimeAsync(0)
    expect(askFailure()).toBe(false)
    vi.useRealTimers()
  })

  it('asks nothing while the switch is off', async () => {
    setSemanticSearch(false)
    setSearchText('黑绿色的龙')
    await settled()
    expect(asked).toHaveLength(0)
  })

  it('holds no answer for a query other than the one in the box', async () => {
    setSearchText('黑绿色的龙')
    await settled()
    setSearchText('白龙')
    await settled()
    expect(ids()).toEqual([])
  })
})


describe('search by picture', () => {
  /** The reader's one gesture: a picture appears. */
  async function choose(): Promise<void> {
    picture.open()
    await picture.stage(new Blob(['jpeg-ish']))
  }

  // A second press would make the reader confirm something they have just done, and work
  // out what the button was for.
  it('asks with the picture the moment it is chosen', async () => {
    sent.answer = new Promise(() => {})
    await choose()
    await settled()
    expect(sent.signals).toHaveLength(1)
    expect(picture.state()).toBe('searching')
  })

  it('ranks the list with the picture, and says where the subject was', async () => {
    sent.answer = Promise.resolve({ ids: [201, 7], box: [0.12, 0.08, 0.64, 0.72] })
    await choose()
    await settled()
    expect(picture.state()).toBe('done')
    expect(route()).toEqual({ by: 'picture', ids: [201, 7] })
    // The sort buttons read this: a picture ranking that got reordered undid itself.
    expect(semanticActive()).toBe(true)
    expect(picture.box()).toEqual([0.12, 0.08, 0.64, 0.72])
  })

  it('answers a busy service with a wait rather than a failure', async () => {
    sent.answer = Promise.resolve({ ids: [], box: null, busy: true })
    await choose()
    await settled()
    expect(picture.state()).toBe('busy')
  })

  // The retry is the one button left: it needs no new file, because the picture is still
  // the one on screen.
  it('retries the picture that is already up', async () => {
    sent.answer = Promise.resolve({ ids: [], box: null, error: 'embed_down', action: 'retry' })
    await choose()
    await settled()
    expect(picture.state()).toBe('failed')
    expect(picture.action()).toBe('retry')
    picture.search()
    await settled()
    expect(sent.signals).toHaveLength(2)
  })

  // An empty answer that says so: nothing broke and nothing was found. Calling that a
  // failure would be wrong.
  it('tells an empty answer apart from a broken one', async () => {
    sent.answer = Promise.resolve({ ids: [], box: null })
    await choose()
    await settled()
    expect(picture.state()).toBe('none')
    expect(picture.error()).toBe('')
    expect(picture.action()).toBe('')
  })

  // When a wait ends with no answer, the reader's own picture has to stay on screen rather
  // than revert to the drop zone. Dropping a mid-flight wait is the store's own seam: no
  // control reaches it, because the only open() left is hidden while the mode is on.
  it('keeps the chosen picture when a wait ends without an answer', async () => {
    sent.answer = new Promise(() => {})
    await choose()
    await settled()
    expect(picture.state()).toBe('searching')
    picture.open() // the wait is called off; no answer ever landed
    expect(pictureWaitingNow()).toBe(false)
    expect(picture.state()).toBe('staged')
    expect(picture.preview()).not.toBe('')
  })

  // A pasted picture replaces the one on screen without going through the toggle, so nothing
  // calls stop first: the request still running has to be dropped by the choice itself, or
  // `search` refuses to start and the new picture sits there wearing the old one's results.
  it('sends a picture pasted while the previous one is still being asked about', async () => {
    sent.answer = new Promise(() => {})   // the first request never comes back
    await choose()
    await settled()
    expect(picture.state()).toBe('searching')

    sent.answer = Promise.resolve({ ids: [301], box: null })
    await picture.stage(new Blob(['pasted']))
    await settled()

    expect(sent.signals[0].aborted).toBe(true)   // the retired question was called off
    expect(sent.signals).toHaveLength(2)         // and these bytes actually went out
    expect(picture.state()).toBe('done')
    expect(route()).toEqual({ by: 'picture', ids: [301] })
  })

  // A second picture replaces the list only when it answers. Until then the reader keeps
  // looking at the first answer.
  it('keeps the first answer on the list while the second picture is on its way', async () => {
    sent.answer = Promise.resolve({ ids: [201, 7], box: null })
    await choose()
    await settled()
    expect(route()).toEqual({ by: 'picture', ids: [201, 7] })

    sent.answer = new Promise(() => {})   // still running
    await picture.stage(new Blob(['second']))
    await settled()
    expect(picture.state()).toBe('searching')
    expect(route()).toEqual({ by: 'picture', ids: [201, 7] })
    expect(semanticActive()).toBe(true)   // the ranking still orders the list
  })

  // A failed upload reports the reason in the panel and leaves the list alone.
  it('keeps the first answer when the second picture fails', async () => {
    sent.answer = Promise.resolve({ ids: [201], box: null })
    await choose()
    await settled()
    sent.answer = Promise.resolve({ ids: [], box: null, error: 'embed_down', action: 'retry' })
    await picture.stage(new Blob(['second']))
    await settled()
    expect(picture.state()).toBe('failed')
    expect(route()).toEqual({ by: 'picture', ids: [201] })
  })

  // Nothing looks like the second picture either: that is an answer, so the list follows it.
  it('lets an empty second answer empty the list', async () => {
    sent.answer = Promise.resolve({ ids: [201], box: null })
    await choose()
    await settled()
    sent.answer = Promise.resolve({ ids: [], box: null })
    await picture.stage(new Blob(['second']))
    await settled()
    expect(picture.state()).toBe('none')
    expect(route()).toEqual({ by: 'picture', ids: [] })
  })

  // A sentence in the hidden box must neither cancel the picture's request nor set its
  // label.
  it('lets a hidden sentence neither abort the picture nor speak for it', async () => {
    picture.open()
    await settled()
    // The box is hidden, but the sentence is still in the signal, waiting to be asked.
    setSearchText('黑绿色的龙')
    await settled()
    expect(asked).toHaveLength(0) // no sentence is asked while a picture is the question
    sent.answer = new Promise(() => {})
    await choose()
    await settled()
    expect(sent.signals).toHaveLength(1)
    setSemanticSearch(false)
    await settled()
    setSemanticSearch(true)
    await settled()
    expect(asked).toHaveLength(0)
    expect(sent.signals[0].aborted).toBe(false)
    expect(picture.state()).toBe('searching')
  })

  // A file the browser cannot decode: not a byte of it left the device, so the service
  // never had the chance to say this.
  it('says so when the browser cannot read the file', async () => {
    sent.unreadable = true
    await choose()
    await settled()
    expect(sent.signals).toHaveLength(0)
    expect(picture.state()).toBe('failed')
    expect(picture.error()).toBe('unreadable')
    expect(picture.action()).toBe('pick')
  })

  it('gives up on a picture that never answers', async () => {
    vi.useFakeTimers()
    sent.answer = new Promise(() => {})
    await choose()
    await vi.advanceTimersByTimeAsync(PICTURE_TIMEOUT_MS)
    expect(picture.state()).toBe('failed')
    expect(picture.error()).toBe('timeout')
    expect(picture.action()).toBe('retry')
    expect(sent.signals[0].aborted).toBe(true)
    vi.useRealTimers()
  })

  it('takes the ranking with it when the mode closes', async () => {
    sent.answer = Promise.resolve({ ids: [201], box: null })
    await choose()
    await settled()
    picture.close()
    expect(picture.on()).toBe(false)
    expect(route()).toEqual({ by: 'none' })
    expect(semanticActive()).toBe(false)
    expect(picture.box()).toBeNull()
  })

  it('drops an in-flight picture when the mode closes', async () => {
    sent.answer = new Promise(() => {})
    await choose()
    await settled()
    picture.close()
    expect(sent.signals[0].aborted).toBe(true)
    expect(semanticPending()).toBe(false)
  })

  it('cuts the sentence that is still on its way', async () => {
    // The box is hidden the moment the mode opens, so whatever was typed is no longer what
    // the reader is asking - and the one waiting slot belongs to the picture now.
    setSearchText('黑绿色的龙')
    await settled()
    expect(asked).toHaveLength(1)
    picture.open()
    expect(asked[0].aborted).toBe(true)
    expect(semanticPending()).toBe(false)
  })

  // A picture and a sentence are one ranking at a time, or the list answers to neither.
  it('lets the picture outrank the sentence that is still in the box', async () => {
    setSearchText('黑绿色的龙')
    await settled()
    sent.answer = Promise.resolve({ ids: [201], box: null })
    await choose()
    await settled()
    expect(route()).toEqual({ by: 'picture', ids: [201] })
  })

  it('keeps the reason the service gave', async () => {
    // The service names which thing failed; the screen turns it into the one action that
    // follows, so the word has to reach it.
    sent.answer = Promise.resolve({ ids: [], box: null, error: 'not_an_image' })
    await choose()
    await settled()
    expect(picture.state()).toBe('failed')
    expect(picture.error()).toBe('not_an_image')
  })

  it('has no reason to say about an answer that worked', async () => {
    sent.answer = Promise.resolve({ ids: [201], box: null })
    await choose()
    await settled()
    expect(picture.error()).toBe('')
  })
  it('draws the box unless it spans the whole picture', async () => {
    // The mask crops to the subject, so the answer for a photograph of a suit against a wall
    // carries a box over both edges. A box over one edge is a band, and a band still tells the
    // reader which part of the picture the service answered from.
    const asked = async (box: number[] | null) => {
      sent.answer = Promise.resolve({ ids: [201], box })
      await choose()
      await settled()
      return picture.box()
    }
    // Both edges over the line: the box is the picture.
    expect(await asked([0.005, 0.05, 0.995, 0.96])).toBeNull()
    expect(await asked([0, 0, 0.9, 0.9])).toBeNull()
    // One edge only: a band, so it stays.
    expect(await asked([0.005, 0.05, 0.995, 0.863])).toEqual([0.005, 0.05, 0.995, 0.863])
    expect(await asked([0.05, 0.005, 0.86, 0.97])).toEqual([0.05, 0.005, 0.86, 0.97])
    expect(await asked([0.25, 0.25, 0.5, 0.5])).toEqual([0.25, 0.25, 0.5, 0.5])
    expect(await asked(null)).toBeNull()
  })

  it('says the picture is still going up until the bytes have left', async () => {
    // Two waits, and they belong to different people: the reader's wifi, then the model.
    // One word for both would blame the wrong one.
    sent.answer = new Promise(() => {})
    await picture.stage(new Blob(['x']))
    await settled()
    expect(picture.state()).toBe('searching')
    expect(picture.uploading()).toBe(true)
    sent.uploaded?.()
    expect(picture.uploading()).toBe(false)
    expect(picture.state()).toBe('searching') // still waiting, now for the answer
  })

  // A tap has to show something the same moment it lands. On a phone the encode runs long
  // enough that a drop zone still sitting there afterwards reads as a dead button, and a
  // browser that paints no frames will not rescue an update waiting on the encode.
  it('puts the chosen picture on screen before the encode finishes', async () => {
    let done: () => void = () => {}
    sent.encodeGate = new Promise((resolve) => { done = resolve })
    picture.open()
    const staging = picture.stage(new Blob(['raw']))
    await settled()
    expect(picture.preview()).not.toBe('')
    expect(picture.state()).toBe('preparing')   // 设备还在算，一个请求都还没发
    expect(sent.signals).toHaveLength(0)   // nothing has gone out: those are not the bytes yet
    done()
    await staging
    await settled()
    expect(sent.signals).toHaveLength(1)
  })

  // Two picks in a row, and the first encode finishes last: it must not answer for the picture
  // the reader has already replaced.
  it('lets the last picture chosen win when encodes overlap', async () => {
    let first: () => void = () => {}
    sent.encodeGate = new Promise((resolve) => { first = resolve })
    picture.open()
    const earlier = picture.stage(new Blob(['first']))
    await settled()
    sent.encodeGate = null
    await picture.stage(new Blob(['second']))
    first()
    await earlier
    await settled()
    expect(sent.signals).toHaveLength(1)
  })

  // Leaving the mode while a picture is still being encoded: the finished job must not put it
  // back on screen, nor ask with it.
  it('does not bring a picture back after the reader left the mode', async () => {
    let done: () => void = () => {}
    sent.encodeGate = new Promise((resolve) => { done = resolve })
    picture.open()
    const staging = picture.stage(new Blob(['gone']))
    await settled()
    picture.close()
    done()
    await staging
    await settled()
    expect(picture.on()).toBe(false)
    expect(picture.state()).toBe('empty')
    expect(sent.signals).toHaveLength(0)
  })

})