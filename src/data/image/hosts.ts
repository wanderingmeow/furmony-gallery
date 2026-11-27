// The hosts that make a picture smaller, and the one call that asks them to. A caller names the box
// and never the host. The boxes themselves are set in CSS, in `draw/layout.ts` and
// `components/ui/boxes.ts`.
import { supportsAvif } from "./avif";

/** The box a picture lands in, which decides the size asked for: `card` is the list and the related
 *  strip, `badge` a small box that shows a whole picture in a tight space, `detail` the large
 *  picture in the sheet, and `full` the zoom, which takes the largest the host answers with.
 *  Nobody asking leaves the original. */
export type PictureSize = "card" | "detail" | "badge" | "full";

/** The boxes a host keeps a ladder for. */
type Stepped = Exclude<PictureSize, "full">;

/** One host's way of taking a smaller picture. The hosts share the sizes above and differ in where
 *  the size is written. */
interface PictureHost {
  /** Whether this host answers for the address. */
  matches: (url: string) => boolean;
  /** Whether the address already carries a size. */
  isSized: (url: string) => boolean;
  /** The address with the size written into it. `full` is asked of the address the listing
   *  carries, which on the bucket is the largest it will answer: that size travels inside the
   *  signed query. `full` takes no format of its own, because the host that resizes to webp
   *  answers `format=webp` on the original with a 404. */
  withSize: (url: string, size: PictureSize) => string;
}

// `imageMogr2` is accepted on a signed address because the signature covers only the parameters it
// lists itself. The `>` on every cap means shrink only, which keeps the aspect ratio.
const COS_BUCKET_SIZES: Record<Stepped, string> = {
  card: "imageMogr2/thumbnail/600x%3E/quality/80/format/webp/strip",
  detail: "imageMogr2/thumbnail/1300x%3E/quality/85/format/webp/strip",
  badge: "imageMogr2/thumbnail/180x%3E/quality/80/format/webp/strip",
};

const COS_BUCKET: PictureHost = {
  matches: (url) => /^https:\/\/[^/]*\.myqcloud\.com\//i.test(url),
  isSized: (url) => url.includes("imageMogr2"),
  withSize: (url, size) =>
    size === "full"
      ? url
      : `${url}${url.includes("?") ? "&" : "?"}${COS_BUCKET_SIZES[size]}`,
};

const HDSLB_SIZES: Record<Stepped, string> = {
  card: "@600w",
  detail: "@1300w",
  badge: "@180w",
};

const HDSLB_URL = /^https:\/\/i\d\.hdslb\.com\//i;

// A second suffix on a path that carries one is answered 400.
const hdslbSized = (url: string): boolean =>
  HDSLB_URL.test(url) && url.includes("@");

// The format follows the size here, and a browser that cannot decode AVIF shows a blank box, so
// `probeAvif` decides whether the suffix is asked for.
const HDSLB: PictureHost = {
  matches: (url) => HDSLB_URL.test(url),
  isSized: hdslbSized,
  // The suffix carries the whole size here, so the path without it is the original.
  withSize: (url, size) =>
    size === "full"
      ? url.replace(/@\d+w(\.(avif|webp))?$/, "")
      : `${url}${HDSLB_SIZES[size]}.${supportsAvif() ? "avif" : "webp"}`,
};

const TWIMG_URL = /^https:\/\/pbs\.twimg\.com\//i;

/** Whether the address is a picture on X's CDN. */
export function isTwimg(url: string): boolean {
  return TWIMG_URL.test(url);
}

// The step is asked for off a ladder this host owns, and a step it does not know is answered 404,
// so an address asked twice is answered 404 as well.
const twimgSized = (url: string): boolean =>
  isTwimg(url) && url.includes("name=");

const TWIMG_STEPS: Record<Stepped, string> = {
  card: "thumb",
  detail: "medium",
  badge: "thumb",
};

// webp is the only format that this host writes, `name=orig` takes no format at all, and a bare
// address is its `medium` step.
const TWIMG: PictureHost = {
  matches: isTwimg,
  isSized: twimgSized,
  withSize: (url, size) =>
    size === "full"
      ? `${url.split("?")[0]}?name=orig`
      : `${url}${url.includes("?") ? "&" : "?"}format=webp&name=${TWIMG_STEPS[size]}`,
};

const PSC_URL =
  /^https:\/\/(?:[^/]+\.)?(?:qpic\.cn|photo\.store\.qq\.com)\/psc\?\//i;

const PSC_ORIGINAL = "b";

const pscSized = (url: string): boolean =>
  PSC_URL.test(url) && !url.endsWith(`!/${PSC_ORIGINAL}`);

// A letter this host does not know answers with the original, and no letter changes the format.
const PSC_LETTERS: Record<Stepped, string> = {
  card: "c",
  detail: "b",
  badge: "m",
};

const PSC: PictureHost = {
  matches: (url) => PSC_URL.test(url),
  isSized: pscSized,
  withSize: (url, size) =>
    url.replace(
      /!\/[a-z]$/,
      `!/${size === "full" ? PSC_ORIGINAL : PSC_LETTERS[size]}`,
    ),
};

const HOSTS: PictureHost[] = [COS_BUCKET, HDSLB, TWIMG, PSC];

/** The same picture, sized for the box it lands in. An address from a host that takes no size
 *  passes through untouched, including the `data:` addresses that development mode reads. */
export function sizedUrl(
  url: string | undefined,
  size: PictureSize,
): string | undefined {
  if (!url) return url;
  const host = HOSTS.find((one) => one.matches(url));
  if (!host) return url;
  // A step written into an address can name a smaller picture than the host holds, so the zoom
  // asks whatever the address carries.
  if (size !== "full" && host.isSized(url)) return url;
  return host.withSize(url, size);
}
