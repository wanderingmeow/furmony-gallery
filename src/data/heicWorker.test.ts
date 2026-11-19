// The HEIF worker's own contract: what it answers, and with which words. The app never talks to
// the library directly, so if this mapping drifts, the reader's sentence drifts with it - and no
// other test can see it, because every other test fakes the worker rather than running it.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_EDGE } from './encodeSpec'
import type { HeicAnswer } from './heicWorker'

const convertHeic = vi.fn()
vi.mock('@su-engineering/heic', () => ({ convertHeic: (...args: unknown[]) => convertHeic(...args) }))

/** Run the worker as a module: it hangs its handler on `self.onmessage`, so the test feeds it
 *  there and reads what it posts. */
async function run(file: Blob): Promise<HeicAnswer> {
  vi.resetModules()
  const sent: HeicAnswer[] = []
  const scope = self as unknown as {
    onmessage?: ((event: { data: Blob }) => void) | null
    postMessage: (message: HeicAnswer) => void
  }
  vi.stubGlobal('postMessage', (message: HeicAnswer) => { sent.push(message) })
  try {
    await import('./heicWorker')
    await scope.onmessage?.({ data: file })
    return sent[0] ?? { blob: null }
  } finally {
    scope.onmessage = null
    vi.unstubAllGlobals()
  }
}

describe('the HEIF worker', () => {
  afterEach(() => { convertHeic.mockReset() })

  // PNG, capped at the same edge the JPEG paths use: the composite crosses back as bytes, and
  // a transparency-preserving format keeps the white ground the encode step lays down.
  it('hands its composite back as a PNG at the shared edge', async () => {
    const png = new Blob(['png'], { type: 'image/png' })
    convertHeic.mockResolvedValue({ blob: png })

    const answer = await run(new Blob(['heic']))

    expect(answer.blob).toBe(png)
    expect(convertHeic).toHaveBeenCalledWith(expect.any(Blob), { type: 'image/png', maxDimension: MAX_EDGE })
  })

  // An error that carries the list of attempts came from a file that parsed as HEIF, and what is
  // missing is a platform HEVC decoder. That case gets its own sentence, with HEIC named in it.
  it('says HEIC when the file parsed and only the codec was missing', async () => {
    convertHeic.mockRejectedValue(Object.assign(new Error('no decoder'), { attempts: ['native', 'webcodecs'] }))

    expect(await run(new Blob(['heic']))).toEqual({ blob: null, heic: true })
  })

  // Anything else was not a HEIF at all, and the reader's photo is not what is being reported.
  it('says nothing about HEIC when the file was not a HEIF', async () => {
    convertHeic.mockRejectedValue(new Error('truncated'))

    expect(await run(new Blob(['not-heic']))).toEqual({ blob: null, heic: false })
  })
})
