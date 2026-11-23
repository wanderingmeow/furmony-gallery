import { type JSX, splitProps } from "solid-js";

export type RemoteImgProps = {
  /** Left out when the caller hands the element an address later, the way the card does while
   *  the page is moving. */
  src?: string;
  /** '' when the picture only decorates a name read beside it. */
  alt?: string;
  ref?: (el: HTMLImageElement) => void;
} & Omit<JSX.ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "ref">;

/**
 * The one element that draws a picture from elsewhere. A host that refuses a foreign referrer
 * answers 403, and on an `<img>` a 403 is a blank box with nothing to say about why - the same
 * shape as a picture that stopped existing. Every picture this app shows arrives from somewhere it
 * does not run, so the ask is fixed here, and writing `<img>` by hand is what the test in
 * `src/noReferrerImages.test.ts` refuses.
 */
export function RemoteImg(props: RemoteImgProps): JSX.Element {
  const [own, rest] = splitProps(props, ["src", "alt", "ref"]);
  return (
    <img
      {...rest}
      ref={own.ref}
      src={own.src}
      alt={own.alt ?? ""}
      referrerpolicy="no-referrer"
    />
  );
}
