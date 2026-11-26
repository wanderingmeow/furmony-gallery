// Decode, scale, flatten and encode, off the main thread.
//
// The whole chain belongs here, not just the encode: `canvas.toBlob()` is async but stays on
// the main thread, and so does `createImageBitmap(canvas)` on a drawn canvas. On a phone each
// measured around 200ms - enough to delay the frames that show the reader their own picture.
// The file arrives as a reference, not a copy.

import type { LocalReason } from "../searchApi";
import type { EncodeReply, EncodeRequest } from "./input";
import type { HeicAnswer } from "./heicWorker";
import { QUALITY, paintOnWhite, targetSize } from "./encodeSpec";

// Both sides read the types that pictureInput declares, so the three files cannot drift apart.

const scope = self as unknown as {
  postMessage(message: EncodeReply): void;
  onmessage: ((event: MessageEvent<EncodeRequest>) => void) | null;
};

/** The HEVC frame inside a HEIF, from a worker that exists only for this one file. */
async function heicPixels(
  file: Blob,
): Promise<{ bitmap: ImageBitmap | null; heic: boolean }> {
  const worker = new Worker(new URL("./heicWorker.ts", import.meta.url), {
    type: "module",
  });
  try {
    const png = await new Promise<HeicAnswer>((done) => {
      const settle = (answer: HeicAnswer) => {
        worker.onmessage = null;
        worker.onerror = null;
        done(answer);
      };
      worker.onmessage = (event: MessageEvent<HeicAnswer>) =>
        settle(event.data);
      worker.onerror = () => settle({ blob: null, heic: false });
      worker.postMessage(file);
    });
    if (!png.blob) return { bitmap: null, heic: png.heic };
    // The copy comes back as PNG bytes; `heicWorker.ts` says what that avoids. Decoded here, the
    // composite is an ordinary single-frame image from then on.
    return { bitmap: await createImageBitmap(png.blob), heic: false };
  } finally {
    worker.terminate();
  }
}

/** Pixels, the reason there are none, or a decline because this run had no parser. */
type Pixels =
  | { bitmap: ImageBitmap; reason?: undefined; declined?: undefined }
  | { bitmap: null; reason: LocalReason; declined?: undefined }
  | { bitmap?: undefined; reason?: undefined; declined: "heif" };

async function pixels(file: Blob, allowHeifParser: boolean): Promise<Pixels> {
  try {
    // createImageBitmap applies the EXIF orientation tag, so width and height come back
    // upright - the same reason the main-thread fallback uses an image element.
    return { bitmap: await createImageBitmap(file) };
  } catch {
    // Not a format this browser decodes.
  }
  // Declining says nothing about the file: the <img> that the caller tries next decodes a HEIC
  // on iOS.
  if (!allowHeifParser) return { declined: "heif" };
  // A CSP that blocks the nested worker must still get an answer: silence costs the reader the
  // whole 20s bound in pictureInput.
  const heic = await heicPixels(file).catch(() => ({
    bitmap: null,
    heic: false,
  }));
  if (heic.bitmap) return { bitmap: heic.bitmap };
  // A file that parsed as HEIF is missing a platform HEVC decoder, not a photo. 读不出来 reads
  // like a broken photo and sends the reader to another app for nothing.
  return { bitmap: null, reason: heic.heic ? "noHevc" : "unreadable" };
}

scope.onmessage = async (event) => {
  const found = await pixels(event.data.file, event.data.allowHeifParser);
  if (found.declined) {
    scope.postMessage({ declined: found.declined });
    return;
  }
  if (!found.bitmap) {
    scope.postMessage({ blob: null, reason: found.reason });
    return;
  }
  try {
    const [width, height] = targetSize(found.bitmap.width, found.bitmap.height);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    paintOnWhite(ctx, found.bitmap, width, height);
    scope.postMessage({
      blob: await canvas.convertToBlob({
        type: "image/jpeg",
        quality: QUALITY,
      }),
    });
  } catch {
    scope.postMessage({ blob: null, reason: "unreadable" });
  } finally {
    found.bitmap.close();
  }
};
