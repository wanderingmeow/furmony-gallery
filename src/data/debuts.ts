/**
 * The debut of a listing: the day it first appeared, posted as an album of photos on Bilibili or as
 * a finished-commission post on X, plus a clip on the studio's own account. The Furmony API has no
 * field for these, so an unpublished script reads those posts and writes `public/debuts.json`,
 * keyed by listing id and carrying nothing else: every byte here is paid by every visit.
 *
 * The cover is baked in because Bilibili's interface sends no cross-origin permission. A page on
 * another site is refused the clip's details as data, while a picture from the same place is refused
 * nothing.
 */

/** The clip, as the delivered file holds it. */
export type DebutVideo = {
  /** Bilibili's id for the clip, which is all its player needs to be pointed at. */
  bv: string;
  cover: string;
  /** How long the clip runs, in whole seconds. */
  seconds: number;
};

export type Debut = { pictures: string[]; video?: DebutVideo };

export type DebutsFile = Record<string, Debut>;

/** Bilibili writes these as `BV` and ten characters of a base58 alphabet it owns. */
const BV = /^BV[1-9A-HJ-NP-Za-km-z]{10}$/;

/** An `<img>` on an https page is refused an address that is not https. */
const isPicture = (value: unknown): value is string =>
  typeof value === "string" && /^https:\/\//i.test(value);

const isBv = (value: unknown): value is string =>
  typeof value === "string" && BV.test(value);

const isRun = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/** The clip as written, or nothing when a part of it is not there. */
function clipOf(raw: unknown): DebutVideo | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const { bv, cover, seconds } = raw as Partial<DebutVideo>;
  if (!isBv(bv) || !isPicture(cover) || !isRun(seconds)) return undefined;
  return { bv, cover, seconds: Math.round(seconds) };
}

/** The file as written, or as much of it as survives: an entry is kept while a picture or a clip is
 *  left in it, since a debut with nothing in it would open the detail on a strip of broken squares. */
export function parseDebuts(data: unknown): Map<number, Debut> {
  const out = new Map<number, Debut>();
  if (typeof data !== "object" || data === null) return out;
  for (const [key, raw] of Object.entries(data as Record<string, unknown>)) {
    const listing = Number(key);
    if (!Number.isInteger(listing) || typeof raw !== "object" || raw === null)
      continue;
    const { pictures, video } = raw as Partial<Debut>;
    const kept = Array.isArray(pictures) ? pictures.filter(isPicture) : [];
    const clip = clipOf(video);
    if (kept.length === 0 && !clip) continue;
    out.set(
      listing,
      clip ? { pictures: kept, video: clip } : { pictures: kept },
    );
  }
  return out;
}

/** The address Bilibili's player answers on. Phones are redirected to a second player, which reads a
 *  switch as the word `true` and ignores a name it has no entry for, so each switch goes on in both
 *  of its names. The part of a multi-part video is `p`: the one name both players read. */
export const playerUrl = (bv: string): string =>
  `https://player.bilibili.com/player.html?bvid=${bv}&p=1&poster=1&autoplay=true&danmaku=false&danmakuClosed=true&noRecommend=true&muted=true`;
