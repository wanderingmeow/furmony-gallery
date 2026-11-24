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
import { RemoteImg } from "../ui/RemoteImg";
import { onImageError, preloadImage, imageReady } from "../../data/image";
import { fittedHeight, heightStyle, moveStyle } from "./picHeight";
import {
  ART_PLACEHOLDER,
  DETAIL_THUMB,
  DETAIL_THUMB_ROW,
  SK_FILL,
} from "../ui/boxes";
import { SkelImg } from "../ui/SkelImg";

/** A picture and the height it stands at. A height of 0 leaves it to the layout. */
type Pic = { src: string; h: number };

type GalleryFlow = {
  /** The first picture has not settled. The skeleton holds the art box. */
  skeleton: { value: null; to: "still" };
  /** One picture is on screen with nothing in flight. */
  still: { input: Pic; value: Pic; to: "loading" };
  /** A newer picture is being fetched behind the one on screen. */
  loading: { value: { src: Accessor<string> }; to: "fading" | "still" };
  /** The newer picture is drawn over the one on screen and waits out its fade. */
  fading: { input: Pic; value: Pic; to: "still" | "loading" };
};

// A frame past the overlay's own 200ms fade.
const FADE_MS = 220;

export function Gallery(props: {
  images: string[];
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
}) {
  const count = () => props.images.length;
  const current = () => props.images[Math.min(props.index(), count() - 1)];

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
        onCleanup(() => job?.cancel());
        return { src: wanted };
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
  const watchWidth = (el: HTMLDivElement) => {
    wrapperEl = el;
    if (typeof ResizeObserver === "undefined") return;
    // Answering in the same step is a ResizeObserver loop: the refit changes the height of a box
    // inside the one being watched.
    sizes ??= new ResizeObserver(() => requestAnimationFrame(refit));
    sizes.observe(el);
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
                    "transition-duration": "200ms",
                  }}
                  onClick={() => props.onOpenFull()}
                  onError={onImageError}
                />
              )}
            </Show>
            {/* a switch shows the spinner while the picture decodes; a first picture shows the
                skeleton */}
            <Show when={overlay() && !overlay()!.ready}>
              <div class="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-black/40 rounded-xl">
                <div class="spinner w-6 h-6" />
              </div>
            </Show>
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
          {/* For keys on the url, so a re-render keeps the thumbnails that are already loaded */}
          <div class={DETAIL_THUMB_ROW}>
            <For each={props.images}>
              {(url, i) => (
                <SelectorThumb
                  url={url}
                  active={i() === props.index()}
                  onSelect={() => props.setIndex(i())}
                />
              )}
            </For>
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
        <div class={DETAIL_THUMB_ROW}>
          <For each={Array.from({ length: props.thumbs })}>
            {() => <div class={`${SK_FILL} ${DETAIL_THUMB}`} />}
          </For>
        </div>
      </Show>
    </div>
  );
}

// A thumbnail in the strip below the picture; it selects its own picture.
function SelectorThumb(props: {
  url: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <SkelImg
      url={props.url}
      box={`${DETAIL_THUMB} cursor-pointer border-2`}
      style={{
        "border-color": props.active ? "var(--color-accent)" : "transparent",
      }}
      onClick={props.onSelect}
    />
  );
}
