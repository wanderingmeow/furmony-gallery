import { createMachine } from "@solid-primitives/state-machine";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  on,
  onCleanup,
  onMount,
  Show,
  Switch,
  untrack,
  type Accessor,
} from "solid-js";
import { tr } from "../../i18n";
import { prefersReducedMotion } from "../../draw/anim";
import { RemoteImg } from "../ui/RemoteImg";
import { onImageError, preloadImage, imageReady } from "../../data/image";
import { fittedHeight, heightStyle, moveStyle } from "./picHeight";
import {
  ART_PLACEHOLDER,
  DETAIL_THUMB,
  DETAIL_THUMB_INNER,
  DETAIL_THUMB_ROW,
  SK_FILL,
} from "../ui/boxes";
import { SkelImg } from "../ui/SkelImg";
import { edgeFade, fadeMask } from "../../draw/fade";

/** A picture and the height it stands at. A height of 0 leaves it to the layout. */
type Pic = { src: string; h: number };

type GalleryFlow = {
  /** The first picture has not settled. The skeleton holds the art box. */
  skeleton: { value: null; to: "still" };
  /** One picture is on screen with nothing in flight. */
  still: { input: Pic; value: Pic; to: "loading" };
  /** A newer picture is being fetched behind the one on screen. The box dims while it waits, and the
   *  spinner joins once the dim has landed and the picture is still out. */
  loading: {
    value: { src: Accessor<string>; spinner: Accessor<boolean> };
    to: "fading" | "still";
  };
  /** The newer picture is drawn over the one on screen and waits out its fade. */
  fading: { input: Pic; value: Pic; to: "still" | "loading" };
};

// The fade of the arriving picture, and a frame past it.
const PICTURE_FADE_MS = 200;
const FADE_MS = PICTURE_FADE_MS + 20;

// How long the dim takes to arrive. A picture already in memory answers inside a frame, so its
// switch never gets the dim out of the way; a slow one earns the spinner only after the dim lands.
const DIM_MS = 160;

// How far each end of the thumbnail strip fades. See `draw/fade.ts`.
const FADE_PX = 24;

export function Gallery(props: {
  images: string[];
  /** The small copy of each picture, for the strip below. Without it the strip reuses the picture. */
  thumbs?: string[];
  index: () => number;
  setIndex: (i: number) => void;
  onOpenFull: () => void;
  /** The tallest picture this may take. Detail passes what the screen leaves; DEFAULT_MAX_H is the
   *  ceiling for a caller that does not. */
  maxH?: number;
  /** Stand at the height the screen gives, whatever the shape of the picture. A switch then keeps
   *  the height of the card around this where it is. */
  holdHeight?: boolean;
  /** The picture settled at a different height, so the card around it has to measure again. */
  onPicHeightChange?: () => void;
  /** How far the strip runs past the card's padding to the screen edge, as the related row does. A
   *  caller that gives nothing keeps the strip inside the padding. */
  bleed?: () => number;
}) {
  const count = () => props.images.length;
  const current = () => props.images[Math.min(props.index(), count() - 1)];

  let strip!: HTMLDivElement;
  // The strip runs to the screen edge and the padding that brings the first thumb back to that edge
  // belongs to the scroller. The same on the far side belongs to the content: Chromium counts a
  // scroller's own trailing padding as scrollable area and WebKit does not, so on the scroller the
  // last thumb would reach the screen edge in one browser and stop short in the other.
  const bleed = () => props.bleed?.() ?? 0;
  const rowStyle = () => ({
    "margin-left": `${-bleed()}px`,
    "margin-right": `${-bleed()}px`,
    "padding-left": `${bleed()}px`,
  });
  const innerStyle = () => ({ "padding-right": `${bleed()}px` });

  // The shared edge maths, at a width wide enough that a thumb half out of the row reads as half out.
  const fade = () => {
    if (!strip) return;
    const mask = fadeMask(edgeFade(strip, FADE_PX), FADE_PX);
    // Both spellings, and from here rather than a stylesheet: Lightning CSS drops the unprefixed
    // declaration next to the prefixed one, and Android WebView reads only that spelling.
    const off = "none";
    strip.style.setProperty("mask-image", mask ?? off);
    strip.style.setProperty("-webkit-mask-image", mask ?? off);
  };

  // The strip holds the whole album, so the thumb of the picture on screen stays in view: a swipe
  // past the squares on show would leave the current one off screen.
  const keepInView = () => {
    const thumb = strip?.querySelector<HTMLElement>(
      `[data-thumb="${props.index()}"]`,
    );
    if (!thumb || strip.scrollWidth <= strip.clientWidth) return;
    const box = thumb.getBoundingClientRect();
    const row = strip.getBoundingClientRect();
    const delta = box.left + box.width / 2 - (row.left + row.width / 2);
    if (Math.abs(delta) < 2) return;
    strip.scrollBy({
      left: delta,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };
  createEffect(
    on([() => props.index(), () => props.images.length], keepInView),
  );

  const DEFAULT_MAX_H = 400;
  const cap = () => props.maxH ?? DEFAULT_MAX_H;
  const [hPx, setHPx] = createSignal(0);
  let wrapperEl!: HTMLDivElement;
  let picEl!: HTMLImageElement;
  let skeletonH = 0;
  const fit = (pic: { naturalWidth: number; naturalHeight: number }): number =>
    fittedHeight(
      pic,
      wrapperEl ? wrapperEl.clientWidth : 0,
      cap(),
      !!props.holdHeight,
    );

  // A picture already in memory needs no skeleton and no fade. The read is for the first picture
  // only, so `untrack` keeps it from subscribing: the layers below follow the index.
  const readyNow = untrack(() => !!current() && imageReady(current()));

  // The picture on screen. Only the flow below moves it, so a switch never shows a blank frame.
  const [shown, setShown] = createSignal(untrack(current));
  // The element's own load, not the fetch behind it, is what lets a picture show.
  const [drawn, setDrawn] = createSignal(readyNow);

  const flow = createMachine<GalleryFlow>({
    initial:
      readyNow || count() === 0
        ? { type: "still", input: { src: untrack(current), h: 0 } }
        : "skeleton",
    states: {
      // A broken picture settles too: it fades in and shows what a broken picture shows.
      skeleton(_, to) {
        createEffect(
          on(current, (src) => {
            if (!src) return;
            const job = preloadImage(src);
            onCleanup(job.cancel);
            void job.ready.then(() => to.still({ src, h: 0 }));
          }),
        );
        return null;
      },
      still(input) {
        setShown(input.src);
        if (input.h > 0) setHPx(input.h);
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
            if (src === shown()) {
              to.still({ src, h: hPx() });
              return;
            }
            to.fading({ src, h: fit(pic) });
          });
        };
        const first = untrack(current);
        if (first) take(first);
        createEffect(
          on(current, (src) => {
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
          on(current, (src) => {
            if (src === shown()) to.still({ src, h: hPx() });
          }),
        );
        return input;
      },
    },
  });

  // A swipe sends the gallery out. `loading` follows the index itself, and `skeleton` preloads on
  // its own, so neither is sent out again here.
  createEffect(
    on(current, (src) => {
      if (!src || src === shown()) return;
      const state = flow();
      if (state.type === "skeleton" || state.type === "loading") return;
      state.to.loading();
    }),
  );

  // One element across both states, so the fade has a 0 to start from.
  const overlay = createMemo(() => {
    const state = flow();
    if (state.type === "loading")
      return { src: state.value.src(), ready: false };
    if (state.type === "fading") return { src: state.value.src, ready: true };
    return null;
  });

  // The dim belongs to the wait, not to a picture: it stands while the flow is fetching, and the
  // spinner joins on the timer the `loading` state keeps for itself.
  const dimmed = () => flow().type === "loading";
  const waiting = () => {
    const state = flow();
    return state.type === "loading" && state.value.spinner();
  };

  // The height the skeleton held comes first, then hPx, and 0 leaves the decision to the layout. A
  // held picture takes the screen's height, which is known before a picture arrives.
  const picHeight = () =>
    heightStyle({
      held: !!props.holdHeight,
      cap: cap(),
      measured: hPx(),
      skeleton: skeletonH,
    });

  // The height animates on the picture itself, and cap() keeps it from running past the first screen.
  const picBox = () => ({ height: picHeight(), "max-height": `${cap()}px` });
  const picMove = () => moveStyle({ held: !!props.holdHeight, eased: eased() });

  // hPx holds the pixels that one width and one ceiling produced, so a change to either redoes it. A
  // refit lands in the same frame, because the card measures against it right after.
  const [eased, setEased] = createSignal(true);
  const refit = () => {
    // A picture that has never been drawn has no pixels to redo.
    if (!untrack(() => flow().type !== "skeleton") || !picEl) return;
    const h = fit(picEl);
    // The same height is not a change: skipping it leaves the easing and the card around it alone.
    if (h <= 0 || h === hPx()) return;
    setEased(false);
    setHPx(h);
    requestAnimationFrame(() => setEased(true));
  };
  let sizes: ResizeObserver | undefined;
  // One observer for both boxes this component watches: the picture, whose width sets the height it
  // fits to, and the strip, whose width sets how far its content reaches. Answered one frame later,
  // because a callback that wrote layout in the same step would re-enter the observer.
  const observe = (el: HTMLElement) => {
    if (typeof ResizeObserver === "undefined") return;
    sizes ??= new ResizeObserver(() =>
      requestAnimationFrame(() => {
        refit();
        fade();
      }),
    );
    sizes.observe(el);
  };
  const watchWidth = (el: HTMLDivElement) => {
    wrapperEl = el;
    observe(el);
  };
  const watchStrip = (el: HTMLDivElement) => {
    strip = el;
    fade();
    observe(el);
  };
  onCleanup(() => sizes?.disconnect());
  createEffect(on(cap, refit));

  // The card is as tall as the picture, so a height change is reported: cap() for a held picture,
  // hPx otherwise. Detail measures the first height, hence `defer: true`.
  createEffect(
    on(
      [hPx, cap],
      ([h, c]) => {
        const tall = props.holdHeight ? c : h;
        if (tall > 0) props.onPicHeightChange?.();
      },
      { defer: true },
    ),
  );

  return (
    <Switch fallback={<div class={`bg-surface-2 ${ART_PLACEHOLDER}`} />}>
      <Match when={flow().type === "skeleton"}>
        <GallerySkeleton
          thumbs={props.images.length}
          maxH={cap()}
          bleed={bleed()}
          onHeight={(px) => (skeletonH = px)}
        />
      </Match>
      <Match when={count() > 0}>
        <div>
          <div class="relative" ref={watchWidth}>
            <Show when={shown()}>
              <RemoteImg
                src={shown()}
                ref={(el) => (picEl = el)}
                class="w-full object-contain rounded-xl bg-surface"
                style={{
                  ...picBox(),
                  transition: picMove(),
                  opacity: drawn() ? 1 : 0,
                }}
                onTransitionEnd={(e) => {
                  // The card stands to this height, so a switch that changed it has to be reported.
                  if (e.propertyName === "height") props.onPicHeightChange?.();
                }}
                onClick={() => props.onOpenFull()}
                onLoad={(e) => {
                  setDrawn(true);
                  setHPx(fit(e.currentTarget));
                }}
                onError={(e) => {
                  setDrawn(true);
                  onImageError(e);
                }} // a broken picture still fades in
              />
            </Show>
            <Show when={overlay()}>
              {(next) => (
                <RemoteImg
                  src={next().src}
                  class="absolute inset-0 w-full h-full object-contain rounded-xl bg-surface transition-opacity"
                  style={{
                    opacity: next().ready ? 1 : 0,
                    "transition-duration": `${PICTURE_FADE_MS}ms`,
                  }}
                  onClick={() => props.onOpenFull()}
                  onError={onImageError}
                />
              )}
            </Show>
            {/* The box dims while a switch is in flight and leaves at the pace of the picture that
                replaces it, so the two cross instead of one blinking off. The spinner stands inside
                the dim and waits for it, so a picture that arrives first never shows a spinner at
                all. The layer takes no tap, which the scrim that stood here did: opening the zoom
                stays possible while a picture is on its way. */}
            <div
              class="no-pick absolute inset-0 flex items-center justify-center rounded-xl bg-white/60 dark:bg-black/40 ease-out transition-opacity pointer-events-none"
              style={{
                opacity: dimmed() ? 1 : 0,
                "transition-duration": `${dimmed() ? DIM_MS : PICTURE_FADE_MS}ms`,
              }}
              aria-hidden="true"
            >
              <div
                class="spinner w-6 h-6 ease-out transition-opacity"
                style={{
                  opacity: waiting() ? 1 : 0,
                  "transition-duration": `${dimmed() ? DIM_MS : PICTURE_FADE_MS}ms`,
                }}
              />
            </div>
          </div>
          <div class="relative h-0">
            {/* The counter floats over the swipe surface, so a held thumb lands on it. A screen
                reader reads the whole line instead of the bare fraction, and reads it again when the
                page turns. */}
            <span
              class="no-pick absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-0.5 rounded-md bg-black/50 text-white text-[11px]"
              role="status"
            >
              <span class="sr-only">
                {tr("detail.photoOf", props.index() + 1, count())}
              </span>
              <span aria-hidden="true">
                {props.index() + 1} / {count()}
              </span>
            </span>
          </div>
          {/* The small copies arrive later, so a square starts on the album's own address and only
              its src changes when they do. */}
          <div
            class={DETAIL_THUMB_ROW}
            ref={watchStrip}
            style={rowStyle()}
            on:scroll={fade}
          >
            <div class={DETAIL_THUMB_INNER} style={innerStyle()}>
              <For each={props.images}>
                {(url, i) => (
                  <SelectorThumb
                    url={props.thumbs?.[i()] ?? url}
                    mark={i()}
                    active={i() === props.index()}
                    onSelect={() => props.setIndex(i())}
                  />
                )}
              </For>
            </div>
          </div>
        </div>
      </Match>
    </Switch>
  );
}

/** The space the gallery takes while the first picture loads: the tallest the first screen allows,
 *  since the card is as tall as its content. The thumbnail strip stands here too. */
function GallerySkeleton(props: {
  thumbs: number;
  maxH: number;
  bleed: number;
  onHeight: (px: number) => void;
}) {
  let bar!: HTMLDivElement;
  onMount(() => props.onHeight(bar.offsetHeight));
  return (
    <div>
      <div
        ref={bar}
        class={`${SK_FILL} ${ART_PLACEHOLDER}`}
        style={{ height: `${props.maxH}px` }}
      />
      <Show when={props.thumbs > 0}>
        <div
          class={DETAIL_THUMB_ROW}
          style={{
            "margin-left": `${-props.bleed}px`,
            "margin-right": `${-props.bleed}px`,
            "padding-left": `${props.bleed}px`,
          }}
        >
          <div
            class={DETAIL_THUMB_INNER}
            style={{ "padding-right": `${props.bleed}px` }}
          >
            <For each={Array.from({ length: props.thumbs })}>
              {() => <div class={`${SK_FILL} ${DETAIL_THUMB}`} />}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

// A thumbnail in the strip below the picture; it selects its own picture. `mark` is its place in
// the album, which is how the strip finds the one to keep in view.
function SelectorThumb(props: {
  url: string;
  mark: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <SkelImg
      url={props.url}
      data-thumb={props.mark}
      box={`${DETAIL_THUMB} cursor-pointer border-2`}
      style={{
        "border-color": props.active ? "var(--color-accent)" : "transparent",
      }}
      onClick={props.onSelect}
    />
  );
}
