// Pictures the code creates in JavaScript: the preloads, the cache question, and the one element
// maker that every one of them goes through.

/**
 * An `<img>` that never reaches the document.
 *
 * Bilibili's CDN answers 403 to a request that names another page in its Referer, and a picture that
 * is not on screen fails without a trace. `RemoteImg` sets the same policy on the elements it draws.
 */
export function offscreenImage(): HTMLImageElement {
  const img = new Image();
  img.referrerPolicy = "no-referrer";
  return img;
}

/**
 * Downloads a picture in the background. `ready` settles with the element once the download
 * finishes. A failed download settles it too, so the caller can still show something.
 *
 * `cancel` stops a download the caller does not need. Dropping the element does not stop the
 * download, so a reader who has moved on still pays for it.
 *
 * After cancel, `ready` never settles. Clearing an address that is still pending fires an error on
 * the element, and the caller would read that error as a finished load.
 */
export function preloadImage(src: string): {
  ready: Promise<HTMLImageElement>;
  cancel: () => void;
} {
  const img = offscreenImage();
  let settle!: (pic: HTMLImageElement) => void;
  const ready = new Promise<HTMLImageElement>((resolve) => {
    settle = resolve;
  });
  let alive = true;
  img.onload = () => {
    if (alive) settle(img);
  };
  img.onerror = () => {
    if (alive) settle(img);
  };
  img.src = src;
  return {
    ready,
    cancel: () => {
      alive = false;
      // A download that already finished has nothing left to stop.
      if (!img.complete) img.src = "";
    },
  };
}

// Whether the browser can hand this picture over without a download. `complete` right after `src` is
// that question: it is true when the picture is in memory, and false when it still has to arrive. A
// picture that is not cached starts a download here, which is the one the caller is about to make,
// so the browser fetches once.
export function imageReady(src: string): boolean {
  const pic = offscreenImage();
  pic.src = src;
  return pic.complete && pic.naturalWidth > 0;
}
