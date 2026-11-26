// src/components/gallery/usePictureMark.ts - what the box says when the square it is on has no
// picture to show.
import {
  createEffect,
  createSignal,
  on,
  onCleanup,
  type Accessor,
} from "solid-js";
import {
  createXGallery,
  type XGallery,
  type XStopped,
} from "../../stores/xReachStore";

export function usePictureMark(box: {
  /** The square the user is on. */
  current: Accessor<string>;
  /** The picture on screen. */
  shown: Accessor<string>;
}) {
  const [broken, setBroken] = createSignal(false);
  const gallery = createXGallery();
  onCleanup(() => gallery.dispose());

  // The answer is asked of the square the user is on: the box may still be holding the pixels of
  // the square they left.
  const readOnX = () => gallery.blocked(box.current());
  // The mark is the answer the wait was for, so the wait ends with it.
  const marked = () => broken() || readOnX() !== undefined;

  // The words stay while the mark fades out: a picture arriving late must not rewrite the sentence
  // on its way off the screen.
  let held: XStopped | undefined;
  createEffect(
    on(marked, (up) => {
      if (up) held = readOnX();
    }),
  );
  const said = () => (marked() ? readOnX() : held);

  createEffect(
    on(box.shown, (url) => {
      setBroken(false);
      // The address going into the document is the sheet asking. The clock runs once.
      gallery.watched(url);
    }),
  );

  return {
    marked,
    /** Why the box is marked, for as long as the user can see the mark. */
    said,
    /** The read the squares' small copies share. */
    gallery: gallery as XGallery,
    /** A picture drew, so the host it was asked of answers. */
    arrived: (url: string): void => {
      gallery.arrived(url);
    },
    /** The address that came back with a failure. */
    failed: (url: string): void => {
      setBroken(true);
      gallery.refused(url);
    },
  };
}
