import type { DebutVideo } from "../../data/debuts";

/**
 * One square of the gallery: a picture, or the clip of the debut standing among them. The same
 * index and the same swipe move between them. What differs is what the box holds and what it costs
 * to ask for it: Bilibili's player downloads about 2.5 MB to draw its poster, more than this whole
 * first screen, so the clip's `url` is its cover and the player arrives only when the user taps the
 * box.
 */
export type GallerySlot =
  | { kind: "pic"; url: string; thumb: string; pic: number }
  | { kind: "clip"; url: string; thumb: string; clip: DebutVideo };

/** The clip's square: the two sizes of cover it asks for, and the clip behind them. */
export type ClipSlot = Extract<GallerySlot, { kind: "clip" }>;

/**
 * The squares, in the order a user swipes through them: the studio's own art, then the clip, then
 * the album of the debut day. `after` counts how many of the studio's own pictures come first; a
 * listing without a clip is the plain list of pictures.
 */
export function gallerySlots(
  urls: string[],
  thumbs: string[],
  clip?: Omit<ClipSlot, "kind">,
  after = 0,
): GallerySlot[] {
  const pics: GallerySlot[] = urls.map((url, pic) => ({
    kind: "pic",
    url,
    thumb: thumbs[pic] ?? url,
    pic,
  }));
  if (!clip) return pics;
  return [
    ...pics.slice(0, after),
    { kind: "clip", ...clip },
    ...pics.slice(after),
  ];
}
