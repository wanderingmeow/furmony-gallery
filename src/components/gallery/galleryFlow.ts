// src/components/gallery/galleryFlow.ts - the states one picture box moves through as the user
// swipes.
import { createMachine } from "@solid-primitives/state-machine";
import {
  createEffect,
  createSignal,
  on,
  onCleanup,
  untrack,
  type Accessor,
} from "solid-js";
import { preloadImage } from "../../data/image";
import { DIM_MS, PICTURE_FADE_MS } from "./PictureLayer";

/** A picture and the height it stands at. A height of 0 leaves it to the layout. */
export type Pic = { src: string; h: number };

export type GalleryFlow = {
  /** The first picture has not settled. The skeleton holds the art box. */
  skeleton: { value: null; to: "still" };
  /** One picture is on screen with nothing in flight. */
  still: { input: Pic; value: Pic; to: "loading" };
  /** A newer picture is being fetched behind the one on screen. */
  loading: {
    value: { src: Accessor<string>; spinner: Accessor<boolean> };
    to: "fading" | "still";
  };
  /** The newer picture is drawn over the one on screen and waits out its fade. */
  fading: { input: Pic; value: Pic; to: "still" | "loading" };
};

// A frame past the pace a layer arrives at, which is where a picture is taken to be settled.
const FADE_MS = PICTURE_FADE_MS + 20;

/**
 * The picture box, as far as a switch is concerned: the picture on screen and the height it stands
 * at, each with the one way to change it. Everything a switch may write is here, so a caller that
 * holds an `ArtBox` holds everything the flow can reach.
 */
export interface ArtBox {
  /** The picture on screen. */
  shown: Accessor<string>;
  /** Write the picture on screen. */
  show: (src: string) => void;
  /** The height the box stands at. */
  height: Accessor<number>;
  /** Raise the box to the height a drawn picture stands at. */
  raise: (h: number) => void;
  /** The height a drawn picture takes in this box. */
  fit: (pic: { naturalWidth: number; naturalHeight: number }) => number;
}

/**
 * The flow of one picture box. The flow is the only thing that writes the box, so a switch never
 * shows a blank frame.
 */
export function createGalleryFlow(
  box: ArtBox & {
    /** The address of the square the user is on. */
    current: Accessor<string>;
    /** The first picture is already in memory. */
    readyNow: boolean;
    /** How many squares there are to swipe. */
    count: number;
  },
) {
  const flow = createMachine<GalleryFlow>({
    initial:
      box.readyNow || box.count === 0
        ? { type: "still", input: { src: untrack(box.current), h: 0 } }
        : "skeleton",
    states: {
      // A broken picture settles too: it fades in and shows what a broken picture shows.
      skeleton(_, to) {
        createEffect(
          on(box.current, (src) => {
            if (!src) return;
            const job = preloadImage(src);
            onCleanup(job.cancel);
            void job.ready.then(() => to.still({ src, h: 0 }));
          }),
        );
        return null;
      },
      still(input) {
        box.show(input.src);
        if (input.h > 0) box.raise(input.h);
        return input;
      },
      // A cancelled job never settles, so leaving this state stops the download.
      loading(_, to) {
        const [wanted, setWanted] = createSignal("");
        // The spinner waits the dim out. A picture that lands behind a dim that never finished would
        // otherwise have put a second thing on screen for one frame and taken it away again.
        const [spinner, setSpinner] = createSignal(false);
        const late = setTimeout(() => setSpinner(true), DIM_MS);
        let job: ReturnType<typeof preloadImage> | undefined;
        const take = (src: string) => {
          job?.cancel();
          setWanted(src);
          job = preloadImage(src);
          void job.ready.then((pic) => {
            // A newer swipe took the fetch over; its own answer is still owed.
            if (wanted() !== src) return;
            // The picture on screen is the one wanted after all: nothing to fade in.
            if (src === box.shown()) {
              to.still({ src, h: box.height() });
              return;
            }
            to.fading({ src, h: box.fit(pic) });
          });
        };
        const first = untrack(box.current);
        if (first) take(first);
        createEffect(
          on(box.current, (src) => {
            if (!src || src === wanted()) return;
            take(src);
          }),
        );
        onCleanup(() => {
          clearTimeout(late);
          job?.cancel();
        });
        return { src: wanted, spinner };
      },
      // The take-over writes the picture and its height through `still`.
      fading(input, to) {
        const fade = setTimeout(() => to.still(input), FADE_MS);
        onCleanup(() => clearTimeout(fade));
        // A swipe back to the picture underneath before the fade ends leaves it on screen.
        createEffect(
          on(box.current, (src) => {
            if (src === box.shown()) to.still({ src, h: box.height() });
          }),
        );
        return input;
      },
    },
  });

  // A swipe sends the gallery out. `loading` follows the index itself, and `skeleton` preloads on
  // its own, so those two need no second send here.
  createEffect(
    on(box.current, (src) => {
      if (!src || src === box.shown()) return;
      const state = flow();
      if (state.type === "skeleton" || state.type === "loading") return;
      state.to.loading();
    }),
  );

  return flow;
}
