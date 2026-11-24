import {
  createEffect,
  createSignal,
  For,
  Match,
  on,
  onCleanup,
  onMount,
  Show,
  Switch,
  untrack,
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

  // A picture already in memory has a known height at the first layout, so the skeleton, the
  // grow, and the fade have no wait to cover. These two reads are for the first picture only, so
  // `untrack` keeps them from subscribing: the layers below follow the index.
  const readyNow = untrack(() => !!current() && imageReady(current()));

  // Two layers, so a switch never shows a blank frame: the old picture stays where it is, the
  // next one loads behind it, then fades in and takes its place.
  const [displayed, setDisplayed] = createSignal(untrack(current));
  const [incoming, setIncoming] = createSignal<string | null>(null);
  const [ready, setReady] = createSignal(false);
  // the displayed picture fades in when it loads
  const [mainLoaded, setMainLoaded] = createSignal(readyNow);

  // The ceiling a caller may raise or lower with maxH.
  const DEFAULT_MAX_H = 400;
  const cap = () => props.maxH ?? DEFAULT_MAX_H;
  // The height the picture animates to. 0 leaves it to the layout.
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

  let cancelPending: (() => void) | null = null;
  let targetH = 0;

  // A transition has no start value while the height is auto, so one frame later that height
  // becomes a number of pixels.
  if (readyNow) {
    onMount(() => {
      // A held picture already stands at the screen's height.
      if (props.holdHeight) return;
      requestAnimationFrame(() => {
        const h = picEl ? picEl.getBoundingClientRect().height : 0;
        if (h > 0) setHPx(h);
      });
    });
  }

  // The skeleton stays until the first picture arrives. Later switches do not use it: the crossfade
  // covers them, and a skeleton over a cached picture hides that picture.
  const [loading, setLoading] = createSignal(count() > 0 && !readyNow);
  let firstDone = readyNow;
  let settled = readyNow;
  createEffect(
    on(current, (src) => {
      if (firstDone) return;
      if (!src) {
        firstDone = true;
        setLoading(false);
        return;
      }
      const job = preloadImage(src);
      onCleanup(job.cancel);
      void job.ready.then(() => {
        firstDone = true;
        setLoading(false);
      });
    }),
  );

  createEffect(
    on([current, displayed, incoming], () => {
      const target = current();
      if (target === displayed() || target === incoming()) return;
      cancelPending?.();
      setIncoming(target);
      setReady(false);
      const job = preloadImage(target);
      cancelPending = job.cancel;
      void job.ready.then((pic) => {
        // A newer switch may have taken over while this download was running.
        if (cancelPending !== job.cancel || current() !== target) return;
        targetH = fit(pic);
        setReady(true);
        cancelPending = null;
      });
    }),
  );

  // After the incoming picture has faded in it becomes the displayed one, and the overlay goes
  // away. The new picture is drawn at the old height first, then hPx animates to the height it
  // needs, so the switch grows or shrinks.
  createEffect(
    on(ready, (isReady) => {
      if (!isReady) return;
      const t = setTimeout(() => {
        const inc = incoming();
        if (inc) {
          setDisplayed(inc);
          setIncoming(null);
          setReady(false);
          settled = true;
          if (targetH > 0) setHPx(targetH);
        }
      }, 220);
      onCleanup(() => clearTimeout(t));
    }),
  );

  // Stop a download that is still running when the gallery goes away: it would take bandwidth
  // away from whatever the user opens next.
  onCleanup(() => {
    cancelPending?.();
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
    if (!settled || !picEl) return;
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
      <Match when={loading()}>
        <GallerySkeleton
          thumbs={props.images.length}
          maxH={cap()}
          onHeight={(px) => (skeletonH = px)}
        />
      </Match>
      <Match when={count() > 0}>
        <div>
          <div class="relative" ref={watchWidth}>
            <Show when={displayed()}>
              <RemoteImg
                src={displayed()}
                ref={(el) => (picEl = el)}
                class="w-full object-contain rounded-xl bg-surface"
                style={{
                  ...picBox(),
                  transition: picMove(),
                  opacity: mainLoaded() ? 1 : 0,
                }}
                onTransitionEnd={(e) => {
                  // The card stands to this height, so a switch that changed it has to be reported.
                  if (e.propertyName === "height") props.onPicHeightChange?.();
                }}
                onClick={() => props.onOpenFull()}
                onLoad={(e) => {
                  setMainLoaded(true);
                  if (settled) return;
                  settled = true;
                  setHPx(fit(e.currentTarget));
                }}
                onError={(e) => {
                  setMainLoaded(true);
                  onImageError(e);
                }} // a broken picture still fades in
              />
            </Show>
            <Show when={incoming()}>
              <RemoteImg
                src={incoming()!}
                class="absolute inset-0 w-full h-full object-contain rounded-xl bg-surface transition-opacity"
                style={{
                  opacity: ready() ? 1 : 0,
                  "transition-duration": "200ms",
                }}
                onClick={() => props.onOpenFull()}
                onError={onImageError}
              />
            </Show>
            {/* a switch shows the spinner while the picture decodes; a first picture shows the
                skeleton */}
            <Show when={incoming() && !ready()}>
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
