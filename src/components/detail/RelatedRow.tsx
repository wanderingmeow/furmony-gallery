import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import type { AdoptListing } from '../../model/types'
import {
  listings, loadRelated, markRelatedNav, related, relatedOnlyUnlocked, setRelatedOnlyUnlocked,
} from '../../store'
import { MIN_RELATED, relatedIds, resolveRelated } from '../../model/related'
import {
  DETAIL_PAD_X, RELATED_CARD_GAP, RELATED_CARD_TARGET, relatedCardWidth, relatedPerView,
  relatedRowHeight,
} from '../../draw/layout'
import { edgeFade, NO_FADE, type EdgeFade } from '../../draw/fade'
import { isAdopted, isLocked } from '../../model/domain'
import { LockedIcon } from '../ui/LockedIcon'
import { onImageError, stableImageUrl } from '../../data/image'

// An adopted piece is also unbuyable: adopting means it was locked first. The lock badge
// on a card and the 只看未锁定 switch both read this, so they cannot disagree.
const isTaken = (l: AdoptListing) => isAdopted(l) || isLocked(l)

export function RelatedRow(props: { item: AdoptListing }) {
  const navigate = useNavigate()
  const adoptId = () => props.item.adoptId

  createEffect(() => { if (adoptId()) void loadRelated() })

  const neighbours = createMemo(() => resolveRelated(relatedIds(related(), adoptId()), listings()))
  const items = createMemo(() =>
    relatedOnlyUnlocked() ? neighbours().filter((l) => !isTaken(l)) : neighbours(),
  )

  // Counted before the switch filters, on purpose: hiding the block while the switch is
  // on would hide the switch too, and nobody could get the full list back.
  const hasEnoughNeighbours = () => neighbours().length >= MIN_RELATED

  // replace, not push: the close button always returns to the grid, so the back gesture
  // must do the same instead of replaying every hop. Because the route holds none of
  // those hops, the ← stack lives in stores/detailHistory.
  const open = (id: number) => {
    markRelatedNav(String(adoptId()))
    navigate(`/detail/${id}`, { replace: true, scroll: false })
  }

  return (
    <Show when={hasEnoughNeighbours()}>
      <section class="mt-4" aria-label="类似设定">
        <div class="flex items-center gap-2">
          <h2 class="text-base font-semibold">类似设定</h2>
          <UnlockedOnlySwitch />
        </div>
        <RelatedStrip items={items()} onOpen={open} />
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
        'bg-blue-500/15 border-blue-400/50 text-blue-700': on(),
        'bg-surface border-border text-muted hover:text-ink': !on(),
      }}
      aria-pressed={on()}
      title="只显示还没被锁定的设定"
      onClick={() => setRelatedOnlyUnlocked(!on())}
    >只看未锁定</button>
  )
}

// A flick that is still coasting keeps writing its own scroll offset. The row stops
// defending its start position this long after the last scroll event.
const COAST_IDLE_MS = 120

// The most a fade gets. An unbounded fade over a bright cover reads as a black edge in
// the dark theme; 0.7 leaves only the hint that the row continues. The band is 56px wide
// so the same change spreads over a longer distance.
const FADE_PEAK = 0.7

// The row itself, and the message that replaces it when the switch filters out every
// neighbour. Both states live here because the message has to reserve exactly the height
// of a row of cards: the sheet must not jump between them.
function RelatedStrip(props: { items: readonly AdoptListing[]; onOpen: (id: number) => void }) {
  // Full-bleed container: -mx cancels the detail body's side padding, so its width is the
  // width the cards get to fill. It stays mounted when the row is empty, which is what
  // makes it a usable measuring stand-in for the missing scroller.
  let root!: HTMLDivElement
  let scroller!: HTMLDivElement

  // right starts full so the first paint already hints that the row continues
  const [fade, setFade] = createSignal<EdgeFade>({ left: 0, right: 1 })
  const [cardW, setCardW] = createSignal(RELATED_CARD_TARGET)

  // The fade has to outlast one snap step (a card plus its gap), otherwise every stop
  // lands on either full or empty. 1.5 steps leaves the last two stops reading 1 → 0.67 → 0.
  const fadeRange = () => (cardW() + RELATED_CARD_GAP) * 1.5

  // An empty row has no scroller, and a node out of the document measures 0 wide, so the
  // wrapper stands in for it.
  const widthSource = () => (scroller?.isConnected ? scroller : root)

  const measure = () => {
    const el = widthSource()
    if (!el) return
    // Width first: Solid writes styles synchronously, so the scroll width that edgeFade
    // reads below already reflects the new card size.
    const avail = el.clientWidth - DETAIL_PAD_X * 2
    setCardW(relatedCardWidth(avail, relatedPerView(avail)))
    setFade(scroller?.isConnected ? edgeFade(scroller, fadeRange()) : NO_FADE)
  }

  // Hopping between related pieces stays on one route, so the row keeps its offset. Clearing
  // it takes more than one write: scroll anchoring undoes the first one within the same
  // frame (measured 710 → 426), and a flick that is still coasting writes its own offset
  // after us — the row then sits past the end of the shorter list, which Safari paints as
  // blank until the reader touches it. So every scroll event presses the row back to the
  // start, until the events stop (COAST_IDLE_MS) or the reader touches the row, which hands
  // the offset back to them.
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
    // The list's fingerprint, not its length: a switch that removes nothing should not
    // drag the reader back to the first card.
    props.items.map((l) => l.adoptId).join(',')
    if (!root) return
    if (scroller?.isConnected) rewind()
    // A node that just mounted reports a width it will not keep; measure again soon.
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
        when={props.items.length > 0}
        fallback={
          <div
            class="flex items-center justify-center text-xs text-faint"
            style={{ height: `${relatedRowHeight(cardW())}px` }}
          >没有未锁定的类似设定</div>
        }
      >
        {/* Safari paints this kind of horizontal scroller as a composited layer above the
            overlay scrollbar, so the row covers that column of the vertical one. Firefox
            draws scrollbars over content and shows nothing wrong. Known, not fixed. */}
        <div class="relative">
          <div
            ref={scroller}
            onScroll={measure}
            class="overflow-x-auto no-scrollbar snap-x snap-mandatory"
            style={{
              'padding-left': `${DETAIL_PAD_X}px`, 'padding-right': `${DETAIL_PAD_X}px`,
              'scroll-padding-left': `${DETAIL_PAD_X}px`, 'scroll-padding-right': `${DETAIL_PAD_X}px`,
            }}
          >
            <div class="flex w-max" style={{ gap: `${RELATED_CARD_GAP}px` }}>
              <For each={props.items}>{(l) => <Card listing={l} width={cardW()} onOpen={props.onOpen} />}</For>
            </div>
          </div>
          {/* Overlays whose opacity changes, rather than elements that come and go: the
              fade has to grow with the scroll distance. The gradient ends at to-canvas/0 —
              to-transparent is rgba(0,0,0,0), which pulls the middle of the ramp toward
              black and looks dirty in the light theme. */}
          <div
            class="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-canvas via-canvas/45 via-40% to-canvas/0"
            style={{ opacity: `${fade().left * FADE_PEAK}` }}
          />
          <div
            class="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-canvas via-canvas/45 via-40% to-canvas/0"
            style={{ opacity: `${fade().right * FADE_PEAK}` }}
          />
        </div>
      </Show>
    </div>
  )
}

function Card(props: { listing: AdoptListing; width: number; onOpen: (id: number) => void }) {
  const l = props.listing
  const locked = isTaken(l)
  const [loaded, setLoaded] = createSignal(false)

  // The src waits for the next frame, like ListingCard: a row of covers must not start a
  // dozen decodes while the sheet is still sliding in.
  let imgRef!: HTMLImageElement
  let raf = 0
  onMount(() => {
    raf = requestAnimationFrame(() => { imgRef.src = stableImageUrl(l.adoptPicture) ?? '' })
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
        <img
          ref={imgRef}
          alt={l.adoptName ?? '设定'}
          decoding="async"
          class="w-full h-full object-cover transition-opacity"
          style={{ 'transition-duration': '300ms' }}
          classList={{ 'opacity-0': !loaded() }}
          onLoad={() => setLoaded(true)}
          onError={(e) => { setLoaded(true); onImageError(e) }}
        />
      </div>
      {/* No artist line: the pool mixes anonymous and named work, so that line would sit
          empty on half the cards. The ID is what lets you recognise a piece you have seen. */}
      <div class="pt-1 flex items-baseline gap-1">
        <span class="text-sm truncate">{l.adoptName ?? '未知'}</span>
        <span class="text-xs text-faint shrink-0">#{l.adoptId}</span>
        <Show when={locked}>
          {/* The row aligns to the baseline so the 14px name and the 12px ID line up, but
              an icon has no baseline and would sit visibly high. */}
          <LockedIcon class="ml-auto shrink-0 self-center" size="12px" />
        </Show>
      </div>
    </button>
  )
}
