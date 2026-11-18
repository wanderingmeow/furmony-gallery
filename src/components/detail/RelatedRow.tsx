import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import type { AdoptListing } from '../../model/types'
import {
  listings, loadRelated, related, relatedLoaded, relatedOnlyUnlocked,
  setRelatedOnlyUnlocked,
} from '../../store'
import { MIN_RELATED, relatedIds, resolveRelated } from '../../model/related'
import {
  DETAIL_PAD_X, RELATED_BAR_GAP, RELATED_BAR_H, RELATED_BAR_MIN_THUMB, RELATED_BAR_W,
  RELATED_CARD_GAP, RELATED_CARD_TARGET, RELATED_PER_VIEW_MAX, relatedCardWidth,
  relatedPerView, relatedStripHeight, THUMB_ASPECT,
} from '../../draw/layout'
import { scrollThumb, type Thumb } from '../../draw/progress'
import { isAdopted, isLocked } from '../../model/domain'
import { LockedIcon } from '../ui/LockedIcon'
import { onImageError, sizedUrl, stableImageUrl } from '../../data/image'
import { SK_FILL } from '../ui/boxes'
import { relatedSkeleton } from '../ui/skeletonView'

// An adopted piece is also unbuyable: adopting means it was locked first. The lock badge
// on a card and the 只看未锁定 switch both read this, so they cannot disagree.
const isTaken = (l: AdoptListing) => isAdopted(l) || isLocked(l)

export function RelatedRow(props: { item: AdoptListing }) {
  const navigate = useNavigate()
  const adoptId = () => props.item.adoptId

  createEffect(() => { if (adoptId()) void loadRelated() })

  const neighbors = createMemo(() => resolveRelated(relatedIds(related(), adoptId()), listings()))
  const items = createMemo(() =>
    relatedOnlyUnlocked() ? neighbors().filter((l) => !isTaken(l)) : neighbors(),
  )

  // Counted before the switch filters: hiding the block while the switch is on would hide
  // the switch too, and nobody could turn it back off.
  const hasEnoughNeighbors = () => neighbors().length >= MIN_RELATED

  // A related tap goes one level deeper, so it stays in browser history: back walks
  // C → B → A → the grid. model/detailTrail explains the marker in the state.
  const open = (id: number) =>
    navigate(`/detail/${id}`, { scroll: false, state: { fromDetail: adoptId() } })

  // The table loads after the sheet is open, so the block holds its space until it does;
  // the switch waits for the same reason - it changes a row that is not on screen yet.
  // ?skeleton=related keeps this true after the table lands, so you can look at the row.
  const loading = () => !relatedLoaded() || relatedSkeleton()

  return (
    <Show when={hasEnoughNeighbors() || loading()}>
      <section class="mt-4" aria-label="类似设定">
        {/* min-h matches the switch's h-8: without it the heading is 8px shorter while the
            table loads, and the row below moves by that much when the switch appears. */}
        <div class="flex min-h-8 items-center gap-2">
          <h2 class="text-base font-semibold">类似设定</h2>
          <Show when={!loading()}><UnlockedOnlySwitch /></Show>
        </div>
        <RelatedStrip items={items()} loading={loading()} onOpen={open} />
      </section>
    </Show>
  )
}

function UnlockedOnlySwitch() {
  const on = relatedOnlyUnlocked
  return (
    <button
      type="button"
      class="ml-auto shrink-0 h-8 px-2.5 rounded-lg border text-xs font-medium transition-colors"
      classList={{
        'bg-accent/15 border-accent/40 text-accent-soft': on(),
        'bg-surface border-border text-muted hover:text-ink': !on(),
      }}
      aria-pressed={on()}
      title="只显示还没被锁定的设定"
      onClick={() => setRelatedOnlyUnlocked(!on())}
    >只看未锁定</button>
  )
}

// A flick keeps writing scroll events after the reader lets go. For this long after the
// last one, the row scrolls back to the start.
const COAST_IDLE_MS = 120

// The row itself, and the message that replaces it when the switch filters out every
// neighbor. Both states are here because the message takes the same height as a full strip:
// the sheet does not jump between them.
function RelatedStrip(props: {
  items: readonly AdoptListing[]
  loading?: boolean
  onOpen: (id: number) => void
}) {
  // Full-bleed container: -mx cancels the detail body's side padding, so its width is the
  // width the cards fill. It stays mounted when the row is empty, so it can stand in for
  // the scroller when measuring.
  let root!: HTMLDivElement
  let scroller!: HTMLDivElement

  const [thumb, setThumb] = createSignal<Thumb | null>(null)
  const [cardW, setCardW] = createSignal(RELATED_CARD_TARGET)

  // An empty row has no scroller, and a node out of the document measures 0 wide.
  const widthSource = () => (scroller?.isConnected ? scroller : root)

  const measure = () => {
    const el = widthSource()
    if (!el) return
    // Width first: Solid writes styles synchronously, so the widths that scrollThumb reads
    // below reflect the new card size.
    const avail = el.clientWidth - DETAIL_PAD_X * 2
    setCardW(relatedCardWidth(avail, relatedPerView(avail)))
    setThumb(el === scroller ? scrollThumb(el, RELATED_BAR_W, RELATED_BAR_MIN_THUMB) : null)
  }

  // Hopping between related pieces stays on one route, so the row keeps its scroll offset.
  // Clearing it once is not enough: scroll anchoring undoes the write in the same frame
  // (measured 710 → 426), and a coasting flick writes another offset after ours. That leaves
  // the row past the end of the shorter list, which Safari paints blank. So the code scrolls
  // the row back on every scroll event, until the events stop (COAST_IDLE_MS) or the reader
  // touches the row.
  const rewind = () => {
    function atStart() {
      if (!scroller?.isConnected) return
      scroller.scrollTo({ left: 0, behavior: 'instant' })
      measure()
    }
    let idle = 0
    function stop() {
      scroller.removeEventListener('scroll', pressing)
      scroller.removeEventListener('touchstart', stop)
      clearTimeout(idle)
    }
    function pressing() {
      atStart()
      clearTimeout(idle)
      idle = setTimeout(stop, COAST_IDLE_MS)
    }
    atStart()
    const raf = requestAnimationFrame(atStart)
    scroller.addEventListener('scroll', pressing)
    scroller.addEventListener('touchstart', stop, { passive: true })
    idle = setTimeout(stop, COAST_IDLE_MS)
    onCleanup(stop)
    onCleanup(() => cancelAnimationFrame(raf))
  }

  createEffect(() => {
    // This tracks which items are shown: a switch that removes nothing does not move the
    // reader back to the first card.
    props.items.map((l) => l.adoptId).join(',')
    if (!root) return
    if (scroller?.isConnected) rewind()
    // A node that just mounted has a width that changes as the sheet settles, so measure
    // again soon.
    queueMicrotask(measure)
    const ro = new ResizeObserver(measure)
    ro.observe(widthSource())
    onCleanup(() => ro.disconnect())
  })

  return (
    <div
      ref={root}
      class="mt-2.5"
      style={{ 'margin-left': `${-DETAIL_PAD_X}px`, 'margin-right': `${-DETAIL_PAD_X}px` }}
    >
      <Show
        when={props.items.length > 0 && !props.loading}
        fallback={
          // Both empty states take the height a full strip takes, measured the same way as
          // the cards, so the sheet does not move when the skeleton leaves or when the filter
          // empties the row.
          <Show
            when={props.loading}
            fallback={
              <div
                class="flex items-center justify-center text-xs text-faint"
                style={{ height: `${relatedStripHeight(cardW())}px` }}
              >
                没有未锁定的类似设定
              </div>
            }
          >
            <div
              role="status"
              aria-label="类似设定载入中"
              style={{ height: `${relatedStripHeight(cardW())}px` }}
            >
              <RelatedSkeleton width={cardW()} />
            </div>
          </Show>
        }
      >
        {/* Safari paints this kind of horizontal scroller as a composited layer above the
            overlay scrollbar, so the row covers that column of the vertical one. Firefox
            draws scrollbars over content and shows nothing wrong. Left as is. */}
        <div
          ref={scroller}
          onScroll={measure}
          class="overflow-x-auto no-scrollbar snap-x snap-mandatory"
          style={{
            'padding-left': `${DETAIL_PAD_X}px`, 'scroll-padding-left': `${DETAIL_PAD_X}px`,
          }}
        >
          {/* The 16px after the last card is padding on the scrolling content. Chromium
              counts a scroller's own trailing padding as scrollable area and WebKit does
              not, so padding on the scroller puts the last card against the screen edge.
              Padding on the content scrolls in both engines. */}
          <div
            class="flex w-max"
            style={{ gap: `${RELATED_CARD_GAP}px`, 'padding-right': `${DETAIL_PAD_X}px` }}
          >
            <For each={props.items}>{(l) => <Card listing={l} width={cardW()} onOpen={props.onOpen} />}</For>
          </div>
        </div>
        {/* The row has no scrollbar. This bar shows how much of the list is off screen and
            where the reader is in it. Both colors are the ones the back-to-top ring uses,
            and both flip with the theme. The space stays in the layout when the thumb is 0px
            wide, so the sheet's height does not change. */}
        <div
          class="rounded-full bg-border"
          aria-hidden="true"
          style={{
            width: `${RELATED_BAR_W}px`, height: `${RELATED_BAR_H}px`,
            margin: `${RELATED_BAR_GAP}px auto 0`,
          }}
        >
          <div
            class="h-full rounded-full bg-accent"
            style={{
              width: `${thumb()?.width ?? 0}px`,
              transform: `translateX(${thumb()?.offset ?? 0}px)`,
            }}
          />
        </div>
      </Show>
    </div>
  )
}

/** The row before the table arrives. The boxes have the sizes a card takes at this width: the
 *  cover at the strip's own aspect, then the 24px caption line, so the cards land in place. */
function RelatedSkeleton(props: { width: number }) {
  return (
    <div
      class="flex overflow-hidden"
      style={{ gap: `${RELATED_CARD_GAP}px`, 'padding-left': `${DETAIL_PAD_X}px` }}
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
  )
}

function Card(props: { listing: AdoptListing; width: number; onOpen: (id: number) => void }) {
  const l = props.listing
  const locked = isTaken(l)
  const [loaded, setLoaded] = createSignal(false)

  // The src is set one frame later, like ListingCard: a row of covers would otherwise start
  // a dozen decodes while the sheet is sliding in.
  let imgRef!: HTMLImageElement
  let raf = 0
  onMount(() => {
    raf = requestAnimationFrame(() => { imgRef.src = sizedUrl(stableImageUrl(l.adoptPicture), 'card') ?? '' })
  })
  onCleanup(() => { if (raf) cancelAnimationFrame(raf) })

  return (
    <button
      type="button"
      class="shrink-0 snap-start text-left"
      style={{ width: `${props.width}px` }}
      onClick={() => props.onOpen(l.adoptId)}
      aria-label={`看 #${l.adoptId} ${l.adoptName ?? ''}`}
    >
      <div class="relative card-img w-full rounded-lg bg-surface-2 overflow-hidden">
        {/* Legacy WebKit draws the layer that an opacity animation creates with square
            corners, and the corners become round again once the animation ends. So the fade runs
            on a box that has the corner and the clip of its own. */}
        <div
          class="w-full h-full rounded-lg overflow-hidden transition-opacity duration-300"
          classList={{ 'opacity-0': !loaded() }}
        >
          <img
            ref={imgRef}
            alt={l.adoptName ?? '设定'}
            decoding="async"
            class="w-full h-full object-cover rounded-lg"
            onLoad={() => setLoaded(true)}
            onError={(e) => { setLoaded(true); onImageError(e) }}
          />
        </div>
      </div>
      {/* No artist line: the pool mixes anonymous and named work, so that line would sit
          empty on half the cards. The ID is what lets you recognize a piece you have seen.
          The 2px of side padding matches the gap that the main card leaves between cover and
          text. */}
      <div class="px-0.5 pt-1 flex items-baseline gap-1">
        <span class="text-sm truncate">{l.adoptName ?? '未知'}</span>
        <span class="text-xs text-faint shrink-0">#{l.adoptId}</span>
        <Show when={locked}>
          {/* The row aligns to the baseline so the 14px name and the 12px ID line up, but
              an icon has no baseline and would sit high. */}
          <LockedIcon class="ml-auto shrink-0 self-center" size="12px" />
        </Show>
      </div>
    </button>
  )
}
