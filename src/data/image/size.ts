// The sizes a picture is asked for, and how each host writes one into an address. The boxes
// themselves are set in CSS, in `draw/layout.ts` and `components/ui/boxes.ts`.

/** The box a picture lands in, which is what decides the size asked for. */
export type PictureSize = "card" | "detail" | "badge";

/**
 * The sizes the cover bucket makes on request. Covers arrive far larger than any card or slot in
 * the app, and often as PNG, so the list loads far more bytes than it shows.
 *
 * The bucket accepts this parameter on a signed address because the signature covers only the
 * parameters it lists.
 *
 * The `>` on every cap means shrink only: a picture smaller than the cap stays as it is. That keeps
 * the aspect ratio, which matters because the full-screen zoom opens on the `detail` address and
 * later puts the original picture over it.
 *
 * `card` is the list and the related strip. `badge` is every small box that shows a whole picture in
 * a tight space: the head circle, the notification avatar, and the strip under the picture in the
 * detail, which would otherwise pull a whole cover for each of its squares. `detail` is the large
 * picture in the sheet. The original is what is left when nobody asks: the full-screen zoom opens on
 * it.
 *
 * A host that ignores the parameter returns the original picture. A host that rejects it fails the
 * load, and `onImageError` then retries the plain address.
 *
 * `/strip` drops metadata. One cover came back at many times the size its pixels need. The extra
 * bytes were metadata: the source file carries a large XMP block, and the bucket copies it into
 * every output, even into low-quality re-encodes. Turning the quality down barely helps; stripping
 * the metadata does. The ICC profile survives, so colors do not shift. No cover on this bucket
 * carries an EXIF orientation tag, so nothing needs rotating.
 */
export const BUCKET_SIZES: Record<PictureSize, string> = {
  card: "imageMogr2/thumbnail/600x%3E/quality/80/format/webp/strip",
  detail: "imageMogr2/thumbnail/1300x%3E/quality/85/format/webp/strip",
  badge: "imageMogr2/thumbnail/180x%3E/quality/80/format/webp/strip",
};

// Bilibili's CDN takes the size on the path instead of the query: `@1300w` is the width cap, and
// `@w` and `@h` together hold a box. The small boxes cut the picture to fill themselves, so an
// address that keeps its shape costs nothing extra there.
const HDSLB_SIZES: Record<PictureSize, string> = {
  card: "@600w",
  detail: "@1300w",
  badge: "@180w",
};

// Bilibili's CDN answers these addresses and takes the size on the path.
const HDSLB_URL = /^https:\/\/i\d\.hdslb\.com\//i;

/** Whether the address is one of Bilibili's pictures. */
export function isHdslb(url: string): boolean {
  return HDSLB_URL.test(url);
}

/** Whether a Bilibili address already carries a size on its path. The album files hold originals,
 *  so a stored address that carries one came from the wrong step, and a second suffix on it makes
 *  the CDN answer 400. */
export function hdslbSized(url: string): boolean {
  return isHdslb(url) && url.includes("@");
}

/** The path suffix that asks Bilibili's CDN for one size in one format. Where that CDN has no AVIF
 *  at the size, it answers with webp, the same bytes the `.webp` address gives. An address that
 *  carries no suffix here is an original, and that is what the built album files hold. */
export function hdslbSuffix(
  size: PictureSize,
  format: "avif" | "webp",
): string {
  return `${HDSLB_SIZES[size]}.${format}`;
}
