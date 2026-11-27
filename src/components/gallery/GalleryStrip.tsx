// src/components/gallery/GalleryStrip.tsx - the small copies under the box, and the strip that
// keeps the one on screen in view.
import { createEffect, For, on, onCleanup, type Accessor } from "solid-js";
import { tr } from "../../i18n";
import { prefersReducedMotion } from "../../draw/anim";
import { edgeFade, fadeMask } from "../../draw/fade";
import {
  DETAIL_THUMB,
  DETAIL_THUMB_INNER,
  DETAIL_THUMB_PIC,
  DETAIL_THUMB_ROW,
} from "../ui/boxes";
import { SkelImg } from "../ui/SkelImg";
import { watchSize } from "../ui/viewport";
import { lastScroll, stripScroll, worthMoving } from "./stripScroll";
import type { GallerySlot } from "./slots";
import type { XGallery } from "../../stores/xReachStore";

// How far each end of the strip fades. See `draw/fade.ts`.
const FADE_PX = 24;

// `18` on its own reads as nothing; `0:18` says how much time the user is being asked to spend.
const clockOf = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export function GalleryStrip(props: {
  slots: GallerySlot[];
  index: Accessor<number>;
  /** Whether the clip is playing, which is what its square's `aria-pressed` answers. */
  playing: Accessor<boolean>;
  /** The sheet's read on X, which every small copy here shares. */
  gallery: XGallery;
  /** A picture's square was tapped. */
  onShow: (at: number) => void;
  /** The clip's square was tapped, which asks for the player as it is chosen. */
  onAsk: (at: number) => void;
  /** How far the strip runs past the card's padding to the screen edge. */
  bleed: Accessor<number>;
}) {
  // The trailing padding goes on the content: Chromium counts a scroller's own trailing padding as
  // scrollable area, and then the last thumb reaches the screen edge in one browser only.
  const bleed = () => props.bleed();
  const rowStyle = () => ({
    "margin-left": `${-bleed()}px`,
    "margin-right": `${-bleed()}px`,
    "padding-left": `${bleed()}px`,
  });
  const innerStyle = () => ({ "padding-right": `${bleed()}px` });

  let strip!: HTMLDivElement;

  // At a width wide enough that a thumb half out of the row reads as half out.
  const fade = () => {
    if (!strip) return;
    const mask = fadeMask(edgeFade(strip, FADE_PX), FADE_PX);
    // The two spellings, written here: Lightning CSS drops the unprefixed declaration next to
    // the prefixed one, and Android WebView reads only that spelling.
    const off = "none";
    strip.style.setProperty("mask-image", mask ?? off);
    strip.style.setProperty("-webkit-mask-image", mask ?? off);
  };

  const keepInView = () => {
    const thumb = strip?.querySelector<HTMLElement>(
      `[data-thumb="${props.index()}"]`,
    );
    if (!thumb || strip.scrollWidth <= strip.clientWidth) return;
    const box = thumb.getBoundingClientRect();
    const row = strip.getBoundingClientRect();
    const delta = box.left + box.width / 2 - (row.left + row.width / 2);
    const to = stripScroll(
      strip.scrollLeft,
      delta,
      lastScroll(strip.scrollWidth, strip.clientWidth),
    );
    if (!worthMoving(to, strip.scrollLeft)) return;
    strip.scrollTo({
      left: to,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };
  createEffect(on([() => props.index(), () => props.slots.length], keepInView));

  let stopFade: (() => void) | undefined;
  const watchStrip = (el: HTMLDivElement) => {
    strip = el;
    fade();
    stopFade = watchSize(el, fade);
  };
  onCleanup(() => stopFade?.());

  return (
    // The small copies arrive later, so a square starts on the album's own address and only its src
    // changes when they do.
    <div
      class={DETAIL_THUMB_ROW}
      ref={watchStrip}
      style={rowStyle()}
      on:scroll={fade}
    >
      <div class={DETAIL_THUMB_INNER} style={innerStyle()}>
        <For each={props.slots}>
          {(one, at) =>
            one.kind === "clip" ? (
              <VideoThumb
                url={one.thumb}
                seconds={one.clip.seconds}
                active={at() === props.index()}
                playing={props.playing()}
                gallery={props.gallery}
                onAsk={() => props.onAsk(at())}
              />
            ) : (
              <SelectorThumb
                url={one.thumb}
                mark={at()}
                active={at() === props.index()}
                gallery={props.gallery}
                onSelect={() => props.onShow(at())}
              />
            )
          }
        </For>
      </div>
    </div>
  );
}

/** The square that offers the clip: Bilibili's own cover, the length written on it, and a mark that
 *  says tapping it starts something. */
function VideoThumb(props: {
  url: string;
  seconds: number;
  active: boolean;
  /** Whether this square's player is running, which is what `aria-pressed` answers. */
  playing: boolean;
  gallery: XGallery;
  onAsk: () => void;
}) {
  return (
    <button
      type="button"
      data-clip=""
      class={`${DETAIL_THUMB} relative shrink-0 cursor-pointer overflow-hidden rounded-md border-2 p-0 text-left`}
      style={{
        "border-color": props.active ? "var(--color-accent)" : "transparent",
      }}
      aria-label={tr("detail.playDebut")}
      aria-pressed={props.playing}
      onClick={() => props.onAsk()}
    >
      <SkelImg url={props.url} box={DETAIL_THUMB_PIC} gallery={props.gallery} />
      <span class="absolute inset-0 grid place-items-center bg-black/35">
        <svg viewBox="0 0 24 24" class="w-5 h-5 text-white" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
      <span class="absolute right-0 bottom-0 px-1 rounded-tl bg-black/60 text-white text-[10px] leading-4">
        {clockOf(props.seconds)}
      </span>
    </button>
  );
}

// A thumbnail in the strip below the picture; it selects its own picture. `mark` is its place in
// the album, which is how the strip finds the one to keep in view.
function SelectorThumb(props: {
  url: string;
  mark: number;
  active: boolean;
  gallery: XGallery;
  onSelect: () => void;
}) {
  return (
    // The border sits on this element and nowhere else: a style handed through a child's props
    // spread is read once, and the highlight would stay on the picture the user left behind.
    <div
      data-thumb={props.mark}
      class={`${DETAIL_THUMB} cursor-pointer overflow-hidden rounded-md border-2`}
      style={{
        "border-color": props.active ? "var(--color-accent)" : "transparent",
      }}
      onClick={() => props.onSelect()}
    >
      <SkelImg url={props.url} box={DETAIL_THUMB_PIC} gallery={props.gallery} />
    </div>
  );
}
