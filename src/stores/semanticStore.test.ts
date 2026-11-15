import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PICTURE_TIMEOUT_MS } from '../data/searchApi'
import { setSemanticSearch } from './displayStore'
import { setSearchText } from './filterStore'

// The fake never resolves, so the only way a request ends is the store aborting it. That
// keeps the test about cancellation rather than about a reply's shape.
const asked = vi.hoisted(() => [] as AbortSignal[])

// Pictures answer when a test says they do, and end when the store aborts them - which is
// exactly what the real fetch does, and the abort is half of what this store is for.
const sent = vi.hoisted(() => ({
  signals: [] as AbortSignal[],
  answer: null as unknown,
  uploaded: null as (() => void) | null,
  // A file the browser itself cannot read: prepare() hands back null.
  unreadable: false,
}))

vi.mock('../data/searchApi', async (importOriginal) => {
  const real = await importOriginal<typeof import('../data/searchApi')>()
  return {
    ...real,
    searchConfigured: true,
    askSettings: (_q: string, signal: AbortSignal) => {
      asked.push(signal)
      return new Promise(() => {})
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
  prepare: async (file: Blob) => (sent.unreadable ? null : file),
  scaleOf: (w: number, h: number) => Math.min(1, 768 / Math.max(w, h)),
}))

const { picture, semanticActive, semanticIds, semanticPending } =
  await import('./semanticStore')

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
  sent.unreadable = false
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
    expect(semanticIds()).toEqual([])
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
    expect(semanticIds()).toEqual([201, 7])
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

  // When a wait ends with no answer, the reader's own picture has to stay on screen.
  it('keeps the chosen picture when a wait ends without an answer', async () => {
    sent.answer = new Promise(() => {})
    await choose()
    await settled()
    expect(picture.state()).toBe('searching')
    picture.open() // entering the mode again: the wait is dropped, no answer ever landed
    expect(pictureWaitingNow()).toBe(false)
    expect(picture.state()).toBe('staged')
    expect(picture.preview()).not.toBe('')
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
    expect(semanticIds()).toEqual([])
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
    expect(semanticIds()).toEqual([201])
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
  it('draws the box only when it leaves something out', async () => {
    // The mask crops to the subject, so a photograph of a suit against a wall comes back
    // with a box that is the picture: drawn, it reads as a broken overlay on the preview's
    // own edge. A design sheet with a margin leaves a box small enough to be worth drawing.
    const asked = async (box: number[] | null) => {
      sent.answer = Promise.resolve({ ids: [201], box })
      await choose()
      await settled()
      return picture.box()
    }
    expect(await asked([0.005, 0.05, 0.995, 0.863])).toBeNull()
    expect(await asked([0.25, 0.25, 0.5, 0.5])).toEqual([0.25, 0.25, 0.5, 0.5])
    expect(await asked([0, 0, 0.89, 0.95])).toBeNull()
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

})