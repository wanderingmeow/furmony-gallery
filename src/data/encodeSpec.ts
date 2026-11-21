// src/data/encodeSpec.ts - what a picture is turned into before it is sent.
//
// Shared by the worker and the fallback path so the two cannot drift apart.

/** The long edge the service re-encodes to; sending more is wasted upload. */
export const MAX_EDGE = 768;

/** Matches the service's own re-encode, so its second pass costs nothing. */
export const QUALITY = 0.85;

/** Never enlarge: the model would then search for detail the photo never had. */
export const scaleOf = (width: number, height: number): number =>
  Math.min(1, MAX_EDGE / Math.max(width, height));

/** One measurement for both encode paths, so they cannot send two different sizes. */
export const targetSize = (width: number, height: number): [number, number] => {
  const scale = scaleOf(width, height);
  return [
    Math.max(1, Math.round(width * scale)),
    Math.max(1, Math.round(height * scale)),
  ];
};

/** The ground goes down first because JPEG has no alpha: the model reads the color underneath,
 *  which under a cut-out is usually black, and a black picture finds the blackest, most generic
 *  listings on the shelf. */
export function paintOnWhite(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  picture: CanvasImageSource,
  width: number,
  height: number,
): void {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(picture, 0, 0, width, height);
}
