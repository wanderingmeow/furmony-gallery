import { tr } from "../../i18n";
import { RemoteImg } from "../ui/RemoteImg";
import { listingName, wordsPending } from "../../model/translatedText";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { useNavigate } from "@solidjs/router";
import { detailPath } from "../../router";
import type { AdoptListing } from "../../model/types";
import { listings } from "../../stores/listingsStore";
import { loadRelated, related, relatedLoaded } from "../../stores/relatedStore";
import {
  relatedOnlyUnlocked,
  setRelatedOnlyUnlocked,
} from "../../stores/displayStore";
import { relatedIds, resolveRelated } from "../../model/related";
import {
  BOX,
  RELATED_BAR_GAP,
  RELATED_BAR_H,
  RELATED_BAR_H_HELD,
  RELATED_BAR_HIT_X,
  RELATED_BAR_HIT_Y,
  RELATED_BAR_MIN_THUMB,
  RELATED_BAR_W,
  RELATED_CARD_GAP,
  RELATED_CARD_TARGET,
  RELATED_PER_VIEW_MAX,
  type Shape,
  relatedCardWidth,
  relatedPerView,
  relatedStripHeight,
  THUMB_ASPECT,
} from "../../draw/layout";
import { pointerProgress, scrollThumb, type Thumb } from "../../draw/scrollbar";
import { shownStatus } from "../../model/domain";
import { LockedIcon } from "../ui/LockedIcon";
import { SkelText } from "../ui/SkelText";
import { onImageError, sizedUrl, stableImageUrl } from "../../data/image";
import { SK_FILL } from "../ui/boxes";
import { relatedSkeleton } from "../ui/skeletonView";
import { debuts } from "../../stores/debutsStore";
import "./RelatedRow.css";

// An album says the piece was made, so 只看可领养 leaves it out even while the shelf still reads
// 未领养.
const isTaken = (l: AdoptListing) =>
  shownStatus(l, debuts().has(l.adoptId)) !== "open";

export function RelatedRow(props: { item: AdoptListing; shape: Shape }) {
  const navigate = useNavigate();
  const adoptId = () => props.item.adoptId;

  createEffect(
    on(adoptId, (id) => {
      if (id) void loadRelated();
    }),
  );

  const allNeighbors = createMemo(() =>
    resolveRelated(relatedIds(related(), adoptId()), listings()),
  );
  const items = createMemo(() =>
    relatedOnlyUnlocked()
      ? allNeighbors().filter((l) => !isTaken(l))
      : allNeighbors(),
  );

  // A related tap goes one level deeper, so the push stays in history: back walks C → B → A → the
  // grid, and the page does not jump to the top on the way. model/detailTrail.ts covers the marker.
  const open = (id: number) =>
    navigate(detailPath(id), {
      scroll: false,
      state: { fromDetail: adoptId() },
    });

  // The table lands after the sheet is open, so the block holds its room until then: a section that
  // arrives mid-read shoves the sheet taller. The switch waits for the same reason - it changes a row
  // that is not on screen yet.
  const loading = () => !relatedLoaded() || relatedSkeleton();

  return (
    <Show when={allNeighbors().length > 0 || loading()}>
      <section class="mt-4" aria-label={tr("related.title")}>
        <div class="flex items-center gap-2">
          <h2 class="text-base font-semibold">{tr("related.title")}</h2>
          <Show
            when={!loading()}
            fallback={<span class="ml-auto h-8" aria-hidden="true" />}
          >
            <UnlockedOnlySwitch />
          </Show>
        </div>
        <RelatedStrip
          items={items()}
          loading={loading()}
          shape={props.shape}
          onOpen={open}
        />
      </section>
    </Show>
  );
}

function UnlockedOnlySwitch() {
  const on = relatedOnlyUnlocked;
  return (
    <button
      type="button"
      class="ml-auto shrink-0 h-8 px-2.5 rounded-lg border text-xs font-medium transition-colors"
      classList={{
        "bg-accent/15 border-accent/40 text-accent-soft": on(),
        "bg-surface border-border text-muted hover:text-ink": !on(),
      }}
      aria-pressed={on()}
      title={tr("filter.onlyUnlocked")}
      onClick={() => setRelatedOnlyUnlocked(!on())}
    >
      {tr("related.onlyUnlockedShort")}
    </button>
  );
}

// A flick keeps writing scroll events after the reader lets go. For this long after the
// last one, the row scrolls back to the start.
const COAST_IDLE_MS = 120;

// The row itself, and the message that replaces it when the switch filters out every
// neighbor. Both states are here because the message takes the same height as a full strip:
// the sheet does not jump between them.
function RelatedStrip(props: {
  items: readonly AdoptListing[];
  loading?: boolean;
  shape: Shape;
  onOpen: (id: number) => void;
}) {
  // Full-bleed container: -mx cancels the detail body's side padding, so its width is the
  // width the cards fill. It stays mounted when the row is empty, so it can stand in for
  // the scroller when measuring.
  let root!: HTMLDivElement;
  let scroller!: HTMLDivElement;
  let content!: HTMLDivElement;

  const bleed = () => BOX[props.shape].stripBleed;

  const [cardW, setCardW] = createSignal(RELATED_CARD_TARGET);

  // An empty row has no scroller, and a node out of the document measures 0 wide.
  const widthSource = () => (scroller?.isConnected ? scroller : root);

  const measure = () => {
    const el = widthSource();
    if (!el) return;
    const avail = el.clientWidth - bleed() * 2;
    setCardW(relatedCardWidth(avail, relatedPerView(avail)));
  };

  // Hopping between related pieces stays on one route, so the row keeps its scroll offset. One
  // write is not enough: scroll anchoring undoes it in the same frame, and a coasting flick
  // writes another offset after ours, which leaves the row past the end of the shorter list -
  // Safari paints that blank. So every scroll event writes 0 again until the events stop
  // (COAST_IDLE_MS) or the reader touches the row.
  const rewind = () => {
    function writeStart() {
      if (!scroller?.isConnected) return;
      scroller.scrollTo({ left: 0, behavior: "instant" });
      measure();
    }
    let idle = 0;
    function stop() {
      scroller.removeEventListener("scroll", keepRewinding);
      scroller.removeEventListener("touchstart", stop);
      clearTimeout(idle);
    }
    function keepRewinding() {
      writeStart();
      clearTimeout(idle);
      idle = setTimeout(stop, COAST_IDLE_MS);
    }
    writeStart();
    const raf = requestAnimationFrame(writeStart);
    scroller.addEventListener("scroll", keepRewinding);
    scroller.addEventListener("touchstart", stop, { passive: true });
    idle = setTimeout(stop, COAST_IDLE_MS);
    onCleanup(stop);
    onCleanup(() => cancelAnimationFrame(raf));
  };

  // The ids of the shown items are the dependency: a switch that removes nothing does not
  // move the reader back to the first card.
  createEffect(
    on(
      () => props.items.map((l) => l.adoptId).join(","),
      () => {
        if (!root) return;
        if (scroller?.isConnected) rewind();
        // A node that just mounted has a width that changes as the sheet settles, so measure
        // again soon.
        queueMicrotask(measure);
        const ro = new ResizeObserver(measure);
        ro.observe(widthSource());
        onCleanup(() => ro.disconnect());
      },
    ),
  );

  return (
    <div
      ref={root}
      class="no-pick mt-2.5"
      style={{
        "margin-left": `${-bleed()}px`,
        "margin-right": `${-bleed()}px`,
      }}
    >
      <Show
        when={props.items.length > 0 && !props.loading}
        fallback={
          <Show
            when={props.loading}
            fallback={
              <div
                class="flex items-center justify-center text-xs text-faint"
                style={{ height: `${relatedStripHeight(cardW())}px` }}
              >
                {tr("related.noneUnlocked")}
              </div>
            }
          >
            <div
              role="status"
              aria-label={tr("related.loading")}
              style={{ height: `${relatedStripHeight(cardW())}px` }}
            >
              <RelatedSkeleton width={cardW()} padLeft={bleed()} />
            </div>
          </Show>
        }
      >
        {/* Safari paints this kind of horizontal scroller as a composited layer above the
            overlay scrollbar, so the row covers that column of the vertical one. Firefox
            draws scrollbars over content and shows nothing wrong. */}
        {/* Only the x axis: a vertical drag over the row still scrolls the sheet. */}
        <div
          ref={scroller}
          onScroll={measure}
          class="overflow-x-auto no-scrollbar snap-x snap-mandatory overscroll-x-contain"
          style={{
            "padding-left": `${bleed()}px`,
            "scroll-padding-left": `${bleed()}px`,
          }}
        >
          {/* The padding after the last card belongs to the scrolling content. Chromium counts a
              scroller's own trailing padding as scrollable area and WebKit does not, so padding on
              the scroller puts the last card against the screen edge. On the content it scrolls in
              both engines. */}
          <div
            ref={content}
            class="flex w-max"
            style={{
              gap: `${RELATED_CARD_GAP}px`,
              "padding-right": `${bleed()}px`,
            }}
          >
            <For each={props.items}>
              {(l) => (
                <Card listing={l} width={cardW()} onOpen={props.onOpen} />
              )}
            </For>
          </div>
        </div>
        <RelatedBar scroller={() => scroller} content={() => content} />
      </Show>
    </div>
  );
}

/** The bar under the cards. The row hides its scrollbar, so this is the only sign of it: how much
 *  of the list is off screen, where the reader is in it, and a handle for the same scroll.
 *
 *  `scroller` is the box that scrolls. `content` is the box whose width is the whole list: a
 *  ResizeObserver reports an element's own box, so watching the scroller alone misses a card resize
 *  that changes only how far the content reaches. */
function RelatedBar(props: {
  scroller: () => HTMLElement | undefined;
  content: () => HTMLElement | undefined;
}) {
  // The 120px box the thumb rides in, and the area that takes the pointer. The area reaches past
  // the box, so the maths reads the box.
  let track!: HTMLDivElement;
  let grabArea!: HTMLDivElement;
  const [thumb, setThumb] = createSignal<Thumb | null>(null);
  const [held, setHeld] = createSignal(false);

  const measure = () => {
    const el = props.scroller();
    setThumb(
      el?.isConnected
        ? scrollThumb(el, RELATED_BAR_W, RELATED_BAR_MIN_THUMB)
        : null,
    );
  };

  // Two ways the picture changes: the reader moves along the row, and the row changes size. The
  // cards are sized by the strip, so a resize lands here one layout later than it is decided.
  onMount(() => {
    const scroller = props.scroller();
    if (!scroller) return;
    measure();
    scroller.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(scroller);
    const content = props.content();
    if (content) ro.observe(content);
    onCleanup(() => {
      scroller.removeEventListener("scroll", measure);
      ro.disconnect();
    });
  });

  // Grabbing the bar makes it the reader's handle: the thumb's center follows the finger, and the
  // row stops snapping so it does not pull away from under it.
  const scrubTo = (event: PointerEvent): void => {
    const scroller = props.scroller();
    const t = thumb();
    if (!scroller || !t) return;
    const progress = pointerProgress(
      event.clientX,
      track.getBoundingClientRect().left,
      RELATED_BAR_W,
      t,
    );
    scroller.scrollTo({
      left: progress * (scroller.scrollWidth - scroller.clientWidth),
      behavior: "instant",
    });
  };
  const grab = (event: PointerEvent) => {
    // The capture keeps the moves coming while the pointer walks past the bar.
    grabArea.setPointerCapture?.(event.pointerId);
    setHeld(true);
    const scroller = props.scroller();
    if (scroller) scroller.style.scrollSnapType = "none";
    scrubTo(event);
  };
  const letGo = (event: PointerEvent) => {
    grabArea.releasePointerCapture?.(event.pointerId);
    setHeld(false);
    const scroller = props.scroller();
    if (scroller) scroller.style.scrollSnapType = "";
  };

  return (
    <div
      ref={track}
      class="relative"
      style={{
        width: `${RELATED_BAR_W}px`,
        height: `${RELATED_BAR_H}px`,
        margin: `${RELATED_BAR_GAP}px auto 0`,
      }}
    >
      {/* The space stays in the layout when the thumb is 0px wide, so the sheet's height does not
          change: the paint is centered in that box and grows inside it, and the grab area reaches
          past the box without taking room. */}
      <div
        class="bar-paint absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-border"
        aria-hidden="true"
        data-held={held()}
        style={{ height: `${held() ? RELATED_BAR_H_HELD : RELATED_BAR_H}px` }}
      >
        <div
          class="h-full rounded-full bg-accent"
          style={{
            width: `${thumb()?.width ?? 0}px`,
            transform: `translateX(${thumb()?.offset ?? 0}px)`,
          }}
        />
      </div>
      <Show when={thumb()}>
        <div
          ref={grabArea}
          class="absolute touch-none"
          style={{
            top: `${-RELATED_BAR_HIT_Y}px`,
            bottom: `${-RELATED_BAR_HIT_Y}px`,
            left: `${-RELATED_BAR_HIT_X}px`,
            right: `${-RELATED_BAR_HIT_X}px`,
          }}
          onPointerDown={grab}
          onPointerMove={(e) => held() && scrubTo(e)}
          onPointerUp={letGo}
          onPointerCancel={letGo}
        />
      </Show>
    </div>
  );
}

/** The row before the table arrives. The boxes have the sizes a card takes at this width: the
 *  cover at the strip's own aspect, then the 24px caption line, so the cards land in place. */
function RelatedSkeleton(props: { width: number; padLeft: number }) {
  return (
    <div
      class="flex overflow-hidden"
      style={{
        gap: `${RELATED_CARD_GAP}px`,
        "padding-left": `${props.padLeft}px`,
      }}
      aria-hidden="true"
    >
      <For each={Array.from({ length: RELATED_PER_VIEW_MAX })}>
        {() => (
          <div class="shrink-0" style={{ width: `${props.width}px` }}>
            <div
              class={`${SK_FILL} w-full rounded-lg`}
              style={{ height: `${props.width / THUMB_ASPECT}px` }}
            />
            <div class={`${SK_FILL} mt-1 h-5 w-2/3 rounded`} />
          </div>
        )}
      </For>
    </div>
  );
}

function Card(props: {
  listing: AdoptListing;
  width: number;
  onOpen: (id: number) => void;
}) {
  // eslint-disable-next-line solid/reactivity -- <For> keys this card by listing id, so props never change
  const l = props.listing;
  const locked = isTaken(l);
  const [loaded, setLoaded] = createSignal(false);

  // The src waits a frame, like ListingCard: the covers decode after the sheet has slid in.
  let imgRef!: HTMLImageElement;
  let raf = 0;
  onMount(() => {
    raf = requestAnimationFrame(() => {
      imgRef.src = sizedUrl(stableImageUrl(l.adoptPicture), "card") ?? "";
    });
  });
  onCleanup(() => {
    if (raf) cancelAnimationFrame(raf);
  });

  return (
    <button
      type="button"
      class="press-host shrink-0 snap-start text-left"
      style={{ width: `${props.width}px` }}
      onClick={() => props.onOpen(l.adoptId)}
      aria-label={tr(
        "related.open",
        l.adoptId,
        wordsPending()
          ? tr("common.listing")
          : (listingName(l) ?? tr("common.listing")),
      )}
    >
      {/* The button is the press and the snap point at once, so only the box inside it scales. */}
      <div class="press-face">
        <div class="relative card-img w-full rounded-lg bg-surface-2 overflow-hidden">
          {/* Legacy WebKit draws the layer that an opacity animation creates with square
              corners, and the corners become round again once the animation ends. So the fade runs
              on a box that has the corner and the clip of its own. */}
          <div
            class="w-full h-full rounded-lg overflow-hidden transition-opacity duration-300"
            classList={{ "opacity-0": !loaded() }}
          >
            <RemoteImg
              ref={(el) => (imgRef = el)}
              alt={
                wordsPending()
                  ? tr("common.listing")
                  : (listingName(l) ?? tr("common.listing"))
              }
              decoding="async"
              class="w-full h-full object-cover rounded-lg"
              onLoad={() => setLoaded(true)}
              onError={(e) => {
                setLoaded(true);
                onImageError(e);
              }}
            />
          </div>
        </div>
        {/* No artist line: half the pool is anonymous work, and the ID is how a piece you have
            seen comes back. The caption keeps its own small inset: these cards are a fraction of the
            main card's width. The top padding is inside RELATED_CAPTION_H in draw/layout.ts, so
            changing it changes the strip's height. */}
        <div class="px-0.5 pt-1 flex items-baseline gap-1">
          <span class="text-sm truncate">
            {wordsPending() ? (
              <SkelText class="h-3.5 w-14" />
            ) : (
              (listingName(l) ?? tr("common.unknown"))
            )}
          </span>
          <span class="text-xs text-faint shrink-0">#{l.adoptId}</span>
          <Show when={locked}>
            {/* An icon has no baseline: the row aligns to the baseline, so this one centers. */}
            <LockedIcon class="ml-auto shrink-0 self-center" size="12px" />
          </Show>
        </div>
      </div>
    </button>
  );
}
