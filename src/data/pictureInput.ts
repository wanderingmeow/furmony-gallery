// src/data/pictureInput.ts - the reader's own picture, made small enough to send.
//
// The service re-encodes whatever arrives at 768px anyway, so the browser downscales first: a
// phone photo is a few megabytes, and the retrieval is the only thing it is used for. The long
// edge is capped, not the short one, because a wide crop of a show floor still needs context.
//
// The work runs in encodeWorker; see that file for why it is not done here. The <img> path
// below stays as the fallback because it is the only thing that decodes HEIC on iOS. Both paths
// apply the EXIF orientation tag, so a photo taken upright in portrait does not come out
// sideways.

import type { LocalReason } from './searchApi'
import { QUALITY, paintOnWhite, targetSize } from './encodeSpec'

const encodesOffThread = (): boolean =>
  typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined'
  && 'convertToBlob' in OffscreenCanvas.prototype

/** A JPEG to send, or the word that says why there is none. Every `LocalReason` has a sentence
 *  in the page. */
export type Prepared =
  { blob: Blob; reason?: undefined }
  | { blob: null; reason: LocalReason }

/** Twenty seconds, where the network leg gets twenty-five. The slowest HEIC measured on a real
 *  phone was under a second, so past this the worker is stuck rather than slow. A spinner the
 *  reader can only leave is worse than a word that offers 换一张. */
const ENCODE_TIMEOUT_MS = 20_000

/** A fresh worker per picture: nothing outlives the picture it was given, so a second choice
 *  cannot be handed the first one's answer. Null means there is no worker to ask. */
async function encodeInWorker(file: File | Blob): Promise<Prepared | null> {
  if (!encodesOffThread()) return null
  try {
    const worker = new Worker(new URL('./encodeWorker.ts', import.meta.url), { type: 'module' })
    try {
      return await new Promise<Prepared>((done) => {
        let timer: ReturnType<typeof setTimeout>
        const settle = (answer: Prepared) => {
          clearTimeout(timer)
          worker.onmessage = null
          worker.onerror = null
          done(answer)
        }
        // The nested HEIF worker answers through this one, so one bound covers both legs.
        timer = setTimeout(() => settle({ blob: null, reason: 'timeout' }), ENCODE_TIMEOUT_MS)
        worker.onmessage = (event: MessageEvent<Prepared>) => settle(event.data)
        worker.onerror = () => settle({ blob: null, reason: 'unreadable' })
        // A Blob posts as a reference, so the megabytes never cross the thread boundary.
        worker.postMessage(file)
      })
    } finally {
      worker.terminate()
    }
  } catch {
    // A CSP that blocks the worker, or a browser without one: the slow path still works.
    return null
  }
}

/** The same picture through an <img>, encoded on the main thread. */
async function encodeViaImage(file: File | Blob): Promise<Blob | null> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    // No img.decode(): it resolves on a task that waits for a frame, and some WebViews stop
    // producing frames while the file picker is up.
    const loaded = await new Promise<boolean>((done) => {
      img.onload = () => done(true)
      img.onerror = () => done(false)
      img.src = url
    })
    if (!loaded) return null

    // naturalWidth and naturalHeight already follow the orientation tag.
    const [width, height] = targetSize(img.naturalWidth, img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    paintOnWhite(ctx, img, width, height)
    return await new Promise<Blob | null>((done) =>
      canvas.toBlob((blob) => done(blob), 'image/jpeg', QUALITY))
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** The picture at most 768px on its long edge, on white, as a JPEG. */
export async function prepare(file: File | Blob): Promise<Prepared> {
  const off = await encodeInWorker(file)
  if (off?.blob) return { blob: off.blob }
  // On iOS an <img> is still the one thing that decodes HEIC, so it gets its turn before
  // anything is called unreadable. Where both fail, the worker's word says more: it looked
  // inside the file.
  const viaImage = await encodeViaImage(file)
  if (viaImage) return { blob: viaImage }
  return off ?? { blob: null, reason: 'unreadable' }
}
