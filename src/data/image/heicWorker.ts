// The HEIF container parser and the HEVC frame inside it.
//
// Its own worker because a bundler puts everything a worker imports into that worker's file:
// parsing HEIC in the encode worker would make every JPEG and every screenshot carry the parser
// they never use.
//
// No WebAssembly: with no `wasmLoader`, the library's cascade stops at the platform codec.

import { convertHeic } from "@su-engineering/heic";
import { MAX_EDGE } from "./encodeSpec";

/** PNG bytes, or the news that nothing decoded them and whether the file was a HEIF at all. */
export type HeicAnswer =
  { blob: Blob; heic?: undefined } | { blob: null; heic: boolean };

const scope = self as unknown as {
  postMessage(message: HeicAnswer): void;
  onmessage: ((event: MessageEvent<Blob>) => void) | null;
};

scope.onmessage = async (event) => {
  try {
    // PNG, not an ImageBitmap: the bitmap this library composites for a tiled HEIC has measured wrong
    // along its last tile row and column on a real phone. `convertHeic` reads its own canvas back on
    // the CPU and encodes it, so the damage never crosses. PNG also keeps transparency, which the encode worker lays on
    // white.
    //
    // A workaround, deletable once the returned bitmap survives a draw. To check: re-run the
    // per-row comparison on a tiled phone HEIC and both paths should land near 1–2. Not
    // reported upstream yet.
    const converted = await convertHeic(event.data, {
      type: "image/png",
      maxDimension: MAX_EDGE,
    });
    scope.postMessage({ blob: converted.blob });
  } catch (error) {
    // An error with attempts came from a file the parser opened and then found no decoder for. An
    // empty list means the container held something that is not a HEVC picture at all (an AVIF in
    // a HEIF wrapper, a file past the parser's pixel limit), and naming a codec the parser never
    // reached sends the user looking for a decoder they do not need. Anything else was no HEIF.
    const attempts = (error as { attempts?: unknown } | null)?.attempts;
    scope.postMessage({
      blob: null,
      heic: Array.isArray(attempts) && attempts.length > 0,
    });
  }
};
