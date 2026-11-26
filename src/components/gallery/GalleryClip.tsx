// src/components/gallery/GalleryClip.tsx - the clip of a debut: when it plays, and the box it
// plays in.
import {
  createEffect,
  createSignal,
  on,
  onCleanup,
  Show,
  type Accessor,
} from "solid-js";
import { tr } from "../../i18n";
import { preloadImage } from "../../data/image";
import { playerUrl } from "../../data/debuts";
import { PictureLayer } from "./PictureLayer";

// The frame's document cannot be read across origins: its load event is the only word this page
// gets, and a frame that never reports is let in when this timer ends.
const FRAME_LATE_MS = 8_000;

/** One listing's clip: whether it plays, and what stops it. */
export function createClipPlayer(clip: {
  /** The square the user is on is the clip's own. */
  atClip: Accessor<boolean>;
  /** The square the user is on. */
  index: Accessor<number>;
  /** The first square's address, so a new album is noticed even on a square that did not move. */
  first: Accessor<string | undefined>;
  /** This listing's clip wherever its square stands, so a new listing is noticed even while the
   *  user looks at a picture. */
  bv: Accessor<string | undefined>;
  /** The cover the clip's square stands on. */
  cover: Accessor<string | undefined>;
}) {
  const [playing, setPlaying] = createSignal(false);
  const [frameUp, setFrameUp] = createSignal(false);
  let lateTimer: ReturnType<typeof setTimeout> | undefined;
  const arrive = (): void => {
    clearTimeout(lateTimer);
    setFrameUp(true);
  };
  const stopFrame = (): void => {
    clearTimeout(lateTimer);
    setFrameUp(false);
  };
  onCleanup(() => clearTimeout(lateTimer));

  // A turned page, a new album, or a clip that is no longer this listing's stops the clip: it
  // belongs to one box of one listing, and its sound should not run on behind another.
  createEffect(
    on([clip.index, clip.first, clip.bv], ([, album, listing], was) => {
      // Leaving the clip's square stops it.
      if (!clip.atClip()) {
        stop();
        return;
      }
      // A new album or a new listing is a different clip.
      if (was && (was[1] !== album || was[2] !== listing)) stop();
    }),
  );

  // The cover is asked for the moment its square is chosen, so the wait is never a black box.
  createEffect(
    on(clip.cover, (url) => {
      if (url) preloadImage(url);
    }),
  );

  // The download starts with the tap: the frame is mounted at once and only its opacity waits.
  const start = (): void => {
    setFrameUp(false);
    lateTimer = setTimeout(() => setFrameUp(true), FRAME_LATE_MS);
    setPlaying(true);
  };
  const stop = (): void => {
    setPlaying(false);
    stopFrame();
  };
  const toggle = (): void => (playing() ? stop() : start());

  return { playing, start, stop, toggle, frameUp, arrive };
}

/** The player over the cover the user looked at last, and the cover's own way into it.
 *
 *  The frame keeps the page's own referrer: Bilibili's CDN answers 403 to a video request that
 *  arrives with none. `no-referrer` belongs on the pictures, whose hosts refuse a foreign one. */
export function ClipLayer(props: {
  bv: string;
  playing: boolean;
  frameUp: boolean;
  /** The player's document has drawn. */
  arrive: () => void;
  onStart: () => void;
}) {
  return (
    <>
      <Show when={props.playing}>
        {/* The layer carries the black the bars sit on, so it arrives with the frame. */}
        <PictureLayer up={props.frameUp} taps="itself">
          <iframe
            class="relative w-full h-full block bg-black"
            src={playerUrl(props.bv)}
            title={tr("detail.playDebut")}
            sandbox="allow-scripts allow-same-origin allow-popups"
            allowfullscreen
            on:load={() => props.arrive()}
          />
        </PictureLayer>
      </Show>
      <Show when={!props.playing}>
        {/* The cover says what the square says: this one moves. */}
        <PictureLayer
          up
          taps={{ pick: props.onStart }}
          label={tr("detail.playDebut")}
          class="grid cursor-pointer place-items-center"
        >
          <span class="grid h-14 w-14 place-items-center rounded-full bg-black/45 text-white">
            <svg viewBox="0 0 24 24" class="h-6 w-6" aria-hidden="true">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          </span>
        </PictureLayer>
      </Show>
    </>
  );
}
