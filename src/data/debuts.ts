/**
 * The debut pictures of a listing: the photos of the day it first appeared, which the studio posts
 * as an album on Bilibili.
 *
 * The Furmony API has no field for these. `scripts/buildDebuts.ts` reads the albums while the site
 * is built and writes `public/debuts.json`, which carries what a visitor needs and nothing else: the
 * album of each listing that has one, keyed by listing id. Who posted an album and when the build
 * read it stay in that script's own file, because every byte here is paid by every visit.
 *
 * The pictures themselves stay where they are; this holds their addresses, and `sizedUrl` asks the
 * host for the size each box wants.
 */

/** The delivered file: listing id to album, in the order the post lists them. */
export type DebutsFile = Record<string, string[]>;

/** An address the app can put in an `<img>` on an https page. */
const isPicture = (value: unknown): value is string =>
  typeof value === "string" && /^https:\/\//i.test(value);

/**
 * The file as written, or as much of it as survives.
 *
 * A listing whose album has nothing left in it is worse than a listing with no debut at all: the
 * detail would open on a strip of broken squares. So an entry is kept only while one address is
 * left in it, and a dropped entry takes its listing id with it.
 */
export function parseDebuts(data: unknown): Map<number, string[]> {
  const out = new Map<number, string[]>();
  if (typeof data !== "object" || data === null) return out;
  for (const [key, raw] of Object.entries(data as Record<string, unknown>)) {
    const listing = Number(key);
    if (!Number.isInteger(listing) || !Array.isArray(raw)) continue;
    const pictures = raw.filter(isPicture);
    if (pictures.length > 0) out.set(listing, pictures);
  }
  return out;
}
