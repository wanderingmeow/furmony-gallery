import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepare, scaleOf } from './pictureInput'

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
   *  naturalWidth and naturalHeight already follow the EXIF orientation tag. */
  function fakeImage(width: number, height: number, fails = false) {
    const seen: string[] = []
    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      naturalWidth = width
      naturalHeight = height
      set src(value: string) { seen.push(value) }
      decode = () => (fails ? Promise.reject(new Error('cannot decode')) : Promise.resolve())
    }
    vi.stubGlobal('Image', FakeImage)
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:staged', revokeObjectURL: () => seen.push('revoked') })
    return seen
  }

  function fakeCanvas(canvas: HTMLCanvasElement) {
    const original = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      (tag === 'canvas' ? canvas as unknown as HTMLCanvasElement : original(tag)))
  }

  // The white ground is what makes this retrieval work, not a decoration. The model has no
  // notion of a transparent pixel: it reads the colour underneath, and under a cut-out that
  // colour is usually black. So the order is the contract - fill white first, then draw.
  it('lays a white ground before the picture is drawn on it', async () => {
    const { canvas, ops } = watchingCanvas()
    fakeImage(3000, 1500)
    fakeCanvas(canvas as unknown as HTMLCanvasElement)

    const out = await prepare(new Blob(['file'], { type: 'image/png' }))

    expect(ops).toEqual(['fillStyle=#fff', 'fillRect', 'drawImage', 'toBlob'])
    expect([canvas.width, canvas.height]).toEqual([768, 384])
    expect(out?.type).toBe('image/jpeg')
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
  // single byte leaves the device. This side only has to return null.
  it('returns nothing for a file the browser cannot decode', async () => {
    const seen = fakeImage(0, 0, true)
    expect(await prepare(new Blob(['nope']))).toBeNull()
    expect(seen).toEqual(['blob:staged', 'revoked'])
  })

  // A picture that decodes to nothing (a zero-byte file, a truncated header) would ask for a
  // zero-sized canvas.
  it('returns nothing when the picture has no size', async () => {
    fakeImage(0, 0)
    expect(await prepare(new Blob(['nope']))).toBeNull()
  })
})
