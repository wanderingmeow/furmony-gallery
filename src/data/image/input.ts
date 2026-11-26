// The reader's own picture, made small enough to send.
//
// The service re-encodes whatever arrives at 768px anyway, so the browser downscales first: a
// phone photo is a few megabytes, and the retrieval is the only thing it is used for. The long
// edge is capped, not the short one, because a wide crop of a show floor still needs context.
//
// `prepare` at the bottom tries three ways to open a picture, cheapest first, and the encode
// worker runs that chain off the main thread. Every path applies the EXIF orientation tag.

import type { LocalReason } from "../searchApi";
import { QUALITY, paintOnWhite, targetSize } from "./encodeSpec";
import { offscreenImage } from "./load";

const encodesOffThread = (): boolean =>
  typeof Worker !== "undefined" &&
  typeof OffscreenCanvas !== "undefined" &&
  "convertToBlob" in OffscreenCanvas.prototype;

/** A JPEG to send, or the word that says why there is none. Every `LocalReason` has a sentence
 *  in the page. */
export type Prepared =
  { blob: Blob; reason?: undefined } | { blob: null; reason: LocalReason };

export type EncodeRequest = { file: Blob; allowHeifParser: boolean };

/** What the encode worker sends back. `declined` is about the run, not the file: this run had no
 *  parser, and the caller has one path left to try. */
export type EncodeReply = Prepared | { declined: "heif" };

/** Twenty seconds for the whole file, however many attempts it takes: the slowest HEIC measured on
 *  a real phone was under a second. The store sets PICTURE_TIMEOUT_MS as a separate limit for the
 *  upload. A spinner with no way out is worse than 换一张. */
const ENCODE_TIMEOUT_MS = 20_000;

/** The brands that name a HEVC photo. The ISO brands are left out: every AVIF carries `mif1` and
 *  every MP4 carries `msf1`, and a HEIC names its picture codec beside them. */
const HEIF_BRANDS = ["heic", "heix", "heim", "heis", "hevc", "hevx"];

/** A photo's `ftyp` box stays inside this. A longer box belongs to a video or another container. */
const FTYP_SNIFF_BYTES = 64;

/** The major brand sits at byte 8 and the compatible brands follow it, so the search starts there. */
function hasHeifBrand(head: Uint8Array): boolean {
  const text = String.fromCharCode(...head);
  if (text.slice(4, 8) !== "ftyp") return false;
  return HEIF_BRANDS.some((brand) => text.includes(brand, 8));
}

/** The type is trusted only when it names HEIF or rules out pictures. A HEIC that arrives as
 *  `image/jpeg` is ordinary, so every image type gets its bytes read. */
async function mightBeHeif(file: Blob): Promise<boolean> {
  if (/heic|heif/i.test(file.type)) return true;
  if (file.type !== "" && !file.type.startsWith("image/")) return false;
  try {
    return hasHeifBrand(
      new Uint8Array(await file.slice(0, FTYP_SNIFF_BYTES).arrayBuffer()),
    );
  } catch {
    return false;
  }
}

/** A fresh worker per run, so a second picture cannot be handed the first one's answer. Null means
 *  this run said nothing about the file: no worker, or the parser was out of reach. */
async function encodeInWorker(
  request: EncodeRequest,
  deadline: number,
): Promise<Prepared | null> {
  if (!encodesOffThread()) return null;
  const left = deadline - Date.now();
  if (left <= 0) return { blob: null, reason: "timeout" };
  try {
    const worker = new Worker(new URL("./encodeWorker.ts", import.meta.url), {
      type: "module",
    });
    try {
      return await new Promise<Prepared | null>((done) => {
        const settle = (answer: Prepared | null) => {
          clearTimeout(timer);
          worker.onmessage = null;
          worker.onerror = null;
          done(answer);
        };
        // The nested HEIF worker answers through this one, so one bound covers both legs.
        const timer = setTimeout(
          () => settle({ blob: null, reason: "timeout" }),
          left,
        );
        worker.onmessage = (event: MessageEvent<EncodeReply>) =>
          settle("declined" in event.data ? null : event.data);
        worker.onerror = () => settle({ blob: null, reason: "unreadable" });
        // A Blob posts as a reference, so the megabytes never cross the thread boundary.
        worker.postMessage(request);
      });
    } finally {
      worker.terminate();
    }
  } catch {
    // A CSP that blocks the worker, or a browser without one: the slow path still works.
    return null;
  }
}

/** The same picture through an <img>, encoded on the main thread. */
async function encodeViaImage(file: File | Blob): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = offscreenImage();
    // No img.decode(): it resolves on a task that waits for a frame, and some WebViews stop
    // producing frames while the file picker is up.
    const loaded = await new Promise<boolean>((done) => {
      img.onload = () => done(true);
      img.onerror = () => done(false);
      img.src = url;
    });
    if (!loaded) return null;

    // naturalWidth and naturalHeight already follow the orientation tag.
    const [width, height] = targetSize(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    paintOnWhite(ctx, img, width, height);
    return await new Promise<Blob | null>((done) =>
      canvas.toBlob((blob) => done(blob), "image/jpeg", QUALITY),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The picture at most 768px on its long edge, on white, as a JPEG. */
export async function prepare(file: File | Blob): Promise<Prepared> {
  const deadline = Date.now() + ENCODE_TIMEOUT_MS;

  const first = await encodeInWorker(
    { file, allowHeifParser: false },
    deadline,
  );
  if (first?.blob) return { blob: first.blob };

  // On iOS an <img> is the only thing that decodes a HEIC, and it costs no bytes. A worker that
  // timed out gets this turn too: the thread may be stuck while the image element is fine.
  const viaImage = await encodeViaImage(file);
  if (viaImage) return { blob: viaImage };

  // Only this run can answer where the browser has no HEVC decoder (Android, desktop Firefox), and
  // it downloads more code, so it comes last. A file that is not a HEIF never reaches it.
  const parsed = (await mightBeHeif(file))
    ? await encodeInWorker({ file, allowHeifParser: true }, deadline)
    : null;
  if (parsed?.blob) return { blob: parsed.blob };
  // The parser opens the container, so its reason is the better one when it ran. Otherwise the
  // first worker's answer stands.
  return parsed ?? first ?? { blob: null, reason: "unreadable" };
}
