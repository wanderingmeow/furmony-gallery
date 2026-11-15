// src/data/heicWorker.ts - the HEIF container parser and the HEVC frame inside it.
//
// Its own worker because a bundler puts everything a worker imports into that worker's file:
// parsing HEIC in the encode worker would make every JPEG and every screenshot carry ~35 kB of
// parser it never uses.
//
// No WebAssembly: with no `wasmLoader`, the library's cascade stops at the platform codec.

import { convertHeic } from '@su-engineering/heic'
import { MAX_EDGE } from './encodeSpec'

/** PNG bytes, or the news that nothing decoded them and whether the file was a HEIF at all. */
export type HeicAnswer =
  { blob: Blob; heic?: undefined }
  | { blob: null; heic: boolean }

const scope = self as unknown as {
  postMessage(message: HeicAnswer): void
  onmessage: ((event: MessageEvent<Blob>) => void) | null
}

scope.onmessage = async (event) => {
  try {
    // PNG rather than an ImageBitmap. A tiled HEIC - most camera photos, 8×6 tiles of 512px -
    // is composited from its tiles, and the bitmap this library returns from that composite has
    // measured wrong along the last tile row and column: on a real phone, 30/255 per pixel
    // across the bottom 15% of a 3072×4096 photo against a macOS decode, with the rest matching
    // within 3. `convertHeic` reads its own canvas back on the CPU and encodes it, so the damage
    // never crosses: same file and device it measures 1–2/255 there, where `decodeHeic` plus our
    // own draw measures 11–17. PNG also keeps transparency, which the encode worker lays on
    // white.
    //
    // A workaround, deletable once the returned bitmap survives a draw. To check: re-run the
    // per-row comparison on a tiled phone HEIC and both paths should land near 1–2. Not
    // reported upstream yet.
    const converted = await convertHeic(event.data, { type: 'image/png', maxDimension: MAX_EDGE })
    scope.postMessage({ blob: converted.blob })
  } catch (error) {
    // An error with attempts came from a file that did parse as HEIF; anything else was no
    // HEIF at all, and the reader's photo is not what is being reported.
    const attempts = (error as { attempts?: unknown } | null)?.attempts
    scope.postMessage({ blob: null, heic: Array.isArray(attempts) })
  }
}
