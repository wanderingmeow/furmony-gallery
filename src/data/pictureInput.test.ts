import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepare, type EncodeReply } from './pictureInput'
import { scaleOf } from './encodeSpec'

/** The first bytes of a HEIF: the header, the major brand at byte 8, the compatible brands from
 *  byte 16. This box is small, so its size fits in the last of the four bytes that hold it. */
function ftypBox(major: string, compatible: string[] = []): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(16 + compatible.length * 4)
  bytes[3] = bytes.length
  const tag = (at: number, text: string) => {
    for (let i = 0; i < 4; i++) bytes[at + i] = text.charCodeAt(i)
  }
  tag(4, 'ftyp')
  tag(8, major)
  compatible.forEach((brand, i) => tag(16 + i * 4, brand))
  return bytes
}

describe('scaleOf', () => {
  // The service reads a picture equally well anywhere between 384 and 1024 pixels, and it
  // resizes whatever arrives. What this function caps is the upper bound: above it, the
  // service would be looking at a different picture than the browser sent.
  it('caps the long edge at 768', () => {
    expect(scaleOf(4000, 3000)).toBeCloseTo(768 / 4000)
    expect(scaleOf(1500, 900)).toBeCloseTo(768 / 1500)
    expect(scaleOf(900, 1500)).toBeCloseTo(768 / 1500)
  })

  it('never enlarges a picture that already fits', () => {
    expect(scaleOf(768, 400)).toBe(1)
    expect(scaleOf(100, 100)).toBe(1)
  })
})

describe('prepare', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** A canvas that records each call in order. */
  function watchingCanvas() {
    const ops: string[] = []
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        set fillStyle(value: string) { ops.push(`fillStyle=${value}`) },
        fillRect: () => { ops.push('fillRect') },
        drawImage: () => { ops.push('drawImage') },
      }),
      toBlob: (done: (blob: Blob | null) => void) => {
        ops.push('toBlob')
        done(new Blob(['jpeg-bytes'], { type: 'image/jpeg' }))
      },
    }
    return { canvas, ops }
  }

  /** Decoding goes through an <img>, so the fake reports the size the browser would show:
   *  naturalWidth and naturalHeight already follow the EXIF orientation tag. The load or error
   *  event arrives from a microtask, which is where the data path delivers it - deliberately
   *  not from a decode() call, because nothing may depend on that existing. */
  function fakeImage(width: number, height: number, fails = false, log?: string[]) {
    const seen: string[] = []
    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      naturalWidth = width
      naturalHeight = height
      set src(value: string) {
        seen.push(value)
        log?.push('img')
        queueMicrotask(() => (fails ? this.onerror?.() : this.onload?.()))
      }
    }
    vi.stubGlobal('Image', FakeImage)
    // A subclass rather than a bare object: the encode path builds a worker from
    // `new URL('./encodeWorker.ts', import.meta.url)`, so URL has to stay constructible.
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = () => 'blob:staged'
      static revokeObjectURL = () => { seen.push('revoked') }
    })
    return seen
  }

  function fakeCanvas(canvas: HTMLCanvasElement) {
    const original = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      (tag === 'canvas' ? canvas as unknown as HTMLCanvasElement : original(tag)))
  }

  /** A browser that can encode off thread - the precondition the worker path asks for. */
  function offscreenThatEncodes() {
    class FakeOffscreen {}
    Object.defineProperty(FakeOffscreen.prototype, 'convertToBlob',
      { value: () => Promise.resolve(new Blob()) })
    vi.stubGlobal('OffscreenCanvas', FakeOffscreen)
  }

  /** One answer per run, in order. */
  function fakeWorker(answers: EncodeReply[], log?: string[]) {
    const files: Blob[] = []
    let run = 0
    class FakeWorker {
      onmessage: ((event: { data: EncodeReply }) => void) | null = null
      onerror: (() => void) | null = null
      constructor() {
        const answer = answers[Math.min(run, answers.length - 1)]
        run += 1
        setTimeout(() => this.onmessage?.({ data: answer }), 0)
      }
      postMessage(request: { file: Blob; allowHeifParser: boolean }) {
        files.push(request.file)
        log?.push(`worker:${request.allowHeifParser ? 'parser' : 'platform'}`)
      }
      terminate() {}
    }
    vi.stubGlobal('Worker', FakeWorker)
    offscreenThatEncodes()
    return { files }
  }

  // The white ground is what makes this retrieval work, not a decoration. The model has no
  // notion of a transparent pixel: it reads the color underneath, and under a cut-out that
  // color is usually black. So the order is the contract - fill white first, then draw.
  it('lays a white ground before the picture is drawn on it', async () => {
    const { canvas, ops } = watchingCanvas()
    fakeImage(3000, 1500)
    fakeCanvas(canvas as unknown as HTMLCanvasElement)

    const out = await prepare(new Blob(['file'], { type: 'image/png' }))

    expect(ops).toEqual(['fillStyle=#fff', 'fillRect', 'drawImage', 'toBlob'])
    expect([canvas.width, canvas.height]).toEqual([768, 384])
    expect(out.blob?.type).toBe('image/jpeg')
  })

  // A phone stores a portrait photo as landscape pixels plus an orientation tag, so the
  // canvas has to follow the decoded size. Taking the width from the file instead would both
  // turn the picture sideways and cap the wrong edge.
  it('follows the orientation-corrected size, not the stored one', async () => {
    const { canvas, ops } = watchingCanvas()
    fakeImage(1500, 3000)      // what a 3000×1500 portrait shot reports once upright
    fakeCanvas(canvas as unknown as HTMLCanvasElement)

    await prepare(new Blob(['file'], { type: 'image/jpeg' }))

    expect([canvas.width, canvas.height]).toEqual([384, 768])
    expect(ops).toContain('drawImage')
  })

  // The staged picture is a Blob URL: the one thing this feature promises is that what the
  // reader uploads is not kept, so the URL has to go even when the decode fails.
  it('releases the object URL it made for the decode', async () => {
    const seen = fakeImage(600, 400)
    const { canvas } = watchingCanvas()
    fakeCanvas(canvas as unknown as HTMLCanvasElement)

    await prepare(new Blob(['file']))

    expect(seen).toEqual(['blob:staged', 'revoked'])
  })

  // An unreadable file is the store's sentence to say, not the service's: it happens before a
  // single byte leaves the device. The word travels with the empty answer, because 读不出来 is
  // the wrong thing to say about a photo this browser could have decoded.
  it('returns nothing for a file the browser cannot decode', async () => {
    const seen = fakeImage(0, 0, true)
    const out = await prepare(new Blob(['nope']))
    expect(out.blob).toBeNull()
    expect(out.reason).toBe('unreadable')
    expect(seen).toEqual(['blob:staged', 'revoked'])
  })

  // A picture that decodes to nothing (a zero-byte file, a truncated header) would ask for a
  // zero-sized canvas.
  it('returns nothing when the picture has no size', async () => {
    fakeImage(0, 0)
    expect((await prepare(new Blob(['nope']))).blob).toBeNull()
  })

  // `toBlob` is async but stays on the main thread, and so does copying a drawn canvas out of
  // it - on a phone that is a few hundred ms of not painting the picture the reader just chose.
  // Where the browser can do the whole chain elsewhere, the main thread must touch no canvas.
  it('sends the whole chain to a worker when the browser can', async () => {
    const { canvas, ops } = watchingCanvas()
    fakeImage(3000, 1500)
    fakeCanvas(canvas as unknown as HTMLCanvasElement)
    const log: string[] = []
    const { files } = fakeWorker([{ blob: new Blob(['worker'], { type: 'image/jpeg' }) }], log)

    const out = await prepare(new Blob(['file'], { type: 'image/jpeg' }))

    expect(ops).toEqual([])
    expect(await files[0]?.text()).toBe('file')
    expect(await out.blob?.text()).toBe('worker')
    // A JPEG the platform decodes should not make the reader download the parser.
    expect(log).toEqual(['worker:platform'])
  })

  // On iOS an <img> is the only thing that decodes a HEIC. The parser stays unloaded here.
  it('asks the image element when the worker cannot decode it', async () => {
    const { canvas, ops } = watchingCanvas()
    const log: string[] = []
    fakeImage(600, 400, false, log)
    fakeCanvas(canvas as unknown as HTMLCanvasElement)
    fakeWorker([{ declined: 'heif' }], log)

    const out = await prepare(new Blob(['heic'], { type: 'image/heic' }))

    expect(ops).toContain('toBlob')
    expect(out.blob).not.toBeNull()
    expect(log).toEqual(['worker:platform', 'img'])
  })

  // The parser comes last: after the <img> has failed too, and only for a file whose own bytes
  // are a HEIF.
  it('asks for the parser last, after the image element has failed', async () => {
    const log: string[] = []
    fakeImage(0, 0, true, log)
    fakeWorker(
      [{ declined: 'heif' }, { blob: new Blob(['parsed'], { type: 'image/jpeg' }) }], log)

    const out = await prepare(new Blob(['heic'], { type: 'image/heic' }))

    expect(log).toEqual(['worker:platform', 'img', 'worker:parser'])
    expect(await out.blob?.text()).toBe('parsed')
  })

  // A PDF gets no parser: the parser could not open it, and the reader is waiting.
  it('keeps the parser away from a file that is not a HEIF', async () => {
    const log: string[] = []
    fakeImage(0, 0, true, log)
    fakeWorker([{ declined: 'heif' }], log)

    const out = await prepare(new Blob(['%PDF-1.4'], { type: 'application/pdf' }))

    expect(log).toEqual(['worker:platform', 'img'])
    expect(out.reason).toBe('unreadable')
  })

  // A picture from another app often arrives with no type, so the code has to read the bytes. The
  // brand here is a compatible one, so the search cannot stop at byte 8.
  it('reads the brand from the bytes when the file gives no type', async () => {
    const log: string[] = []
    fakeImage(0, 0, true, log)
    fakeWorker([{ declined: 'heif' }, { blob: null, reason: 'noHevc' }], log)

    const out = await prepare(new Blob([ftypBox('mif1', ['heic'])]))

    expect(log).toEqual(['worker:platform', 'img', 'worker:parser'])
    expect(out.reason).toBe('noHevc')
  })

  // A HEIC that arrives as image/jpeg is ordinary. Trust the type here and the reader gets
  // 读不出来 about a photo that the parser opens.
  it('reads the bytes when the type says it is something else', async () => {
    const log: string[] = []
    fakeImage(0, 0, true, log)
    fakeWorker(
      [{ declined: 'heif' }, { blob: new Blob(['parsed'], { type: 'image/jpeg' }) }], log)

    const out = await prepare(new Blob([ftypBox('heic')], { type: 'image/jpeg' }))

    expect(log).toEqual(['worker:platform', 'img', 'worker:parser'])
    expect(await out.blob?.text()).toBe('parsed')
  })

  // The parser opens the container, so its reason is the one the reader sees once the two cheaper
  // paths have failed.
  it('keeps the parser\u2019s reason when nothing else could open the file', async () => {
    fakeImage(0, 0, true)
    fakeWorker([{ declined: 'heif' }, { blob: null, reason: 'noHevc' }])

    const out = await prepare(new Blob(['heic'], { type: 'image/heic' }))

    expect(out.blob).toBeNull()
    expect(out.reason).toBe('noHevc')
  })

  // A worker that never answers would leave the reader in 加载中 with only 退出. One bound covers
  // the whole file, so the parser run cannot start a fresh 20 seconds after the first one hung.
  it('gives up on a worker that never answers, without a second run', async () => {
    vi.useFakeTimers()
    fakeImage(0, 0, true)   // the image element cannot help either
    let made = 0
    class SilentWorker {
      onmessage: ((event: { data: EncodeReply }) => void) | null = null
      onerror: (() => void) | null = null
      constructor() { made += 1 }
      postMessage() {}
      terminate() {}
    }
    vi.stubGlobal('Worker', SilentWorker)
    offscreenThatEncodes()

    const going = prepare(new Blob(['heic'], { type: 'image/heic' }))
    await vi.advanceTimersByTimeAsync(20_000)
    const out = await going

    expect(out.blob).toBeNull()
    expect(out.reason).toBe('timeout')
    expect(made).toBe(1)
    vi.useRealTimers()
  })

  // A browser that blocks the worker - a strict CSP, an older build - still gets a picture,
  // just encoded on the main thread, where it is slower.
  it('falls back to the main thread when the worker cannot be made', async () => {
    const { canvas, ops } = watchingCanvas()
    fakeImage(600, 400)
    fakeCanvas(canvas as unknown as HTMLCanvasElement)
    vi.stubGlobal('Worker', class { constructor() { throw new Error('CSP refused the worker') } })
    offscreenThatEncodes()

    const out = await prepare(new Blob(['file'], { type: 'image/jpeg' }))

    expect(ops).toContain('toBlob')
    expect(out.blob).not.toBeNull()
  })
})
