// The hosts that make a picture smaller, and the one call that asks them to. A caller names the box
// and never the host.
import { supportsAvif } from "./avif";
import {
  BUCKET_SIZES,
  hdslbSized,
  hdslbSuffix,
  isHdslb,
  type PictureSize,
} from "./size";

/**
 * One host's way of taking a smaller picture. The hosts share the sizes in `size.ts` and differ in
 * where the size is written.
 */
interface PictureHost {
  /** Whether this host answers for the address. */
  matches: (url: string) => boolean;
  /** Whether the address already carries a size, so writing a second one would be wrong. */
  isSized: (url: string) => boolean;
  /** The address with the size written into it. */
  withSize: (url: string, size: PictureSize) => string;
}

const BUCKET: PictureHost = {
  matches: (url) => /^https:\/\/[^/]*\.myqcloud\.com\//i.test(url),
  isSized: (url) => url.includes("imageMogr2"),
  withSize: (url, size) =>
    `${url}${url.includes("?") ? "&" : "?"}${BUCKET_SIZES[size]}`,
};

// The format follows the size. A browser that cannot decode AVIF shows a blank box, so `probeAvif`
// decides whether the suffix is asked for.
const HDSLB: PictureHost = {
  matches: isHdslb,
  isSized: hdslbSized,
  withSize: (url, size) =>
    `${url}${hdslbSuffix(size, supportsAvif() ? "avif" : "webp")}`,
};

const HOSTS: PictureHost[] = [BUCKET, HDSLB];

/**
 * The same picture, sized for the box it lands in. A caller names the box and never the host: the
 * size is written the way that host asks for it, and an address from a host that takes no size
 * passes through untouched, including the `data:` addresses that development mode reads.
 */
export function sizedUrl(
  url: string | undefined,
  size: PictureSize,
): string | undefined {
  if (!url) return url;
  const host = HOSTS.find((one) => one.matches(url));
  return !host || host.isSized(url) ? url : host.withSize(url, size);
}
