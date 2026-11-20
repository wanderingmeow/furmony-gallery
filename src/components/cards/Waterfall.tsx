import { tr } from '../../i18n'
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js'
import type { AdoptListing } from '../../model/types'
import { filteredListings } from '../../stores/derivedStore'
import {
  firstVisibleId, setFirstVisibleId, persistSession,
} from '../../stores/sessionStore'
import { semanticActive } from '../../stores/semanticStore'
import { sortMode, setOnFilterChange } from '../../stores/filterStore'
import {
  GAP, OVERSCAN_ROWS, PREVIEW_FADE_MS, PREVIEW_H, PREVIEW_IDLE_MS, PREVIEW_SCROLLBAR_GAP, VIEW_PAD,
  indexOfRow, rowOfIndex, waterfallCardWidth, waterfallCols, waterfallRowHeight,
} from '../../draw/layout'
import { publishDayAt } from '../../model/domain'
import { orderLabel } from '../../model/filter'
import { SAVE_THROTTLE_MS, findIndex } from '../../draw/scrollRestore'
import { previewTop } from '../../draw/scrollbar'
import { createScrollMotion } from '../../draw/scrollMotion'
import { ListingCard } from './ListingCard'
import { FloatingActions } from '../fab/FloatingActions'
import { EmptyState } from '../ui/EmptyState'
import { watchViewport } from '../ui/viewport'

export function Waterfall(props: { onOpen: (id: number) => void; topOffset: () => number }) {
  // The list scrolls the document (html/body), not an inner div: tapping the iOS status bar
  // and pressing Home on a desktop both act on the document's main scrollable. So these signals
  // follow the window.
  const { viewportH, frameW } = watchViewport()
  const [scrollTop, setScrollTop] = createSignal(window.scrollY)

  const items = filteredListings
  const cols = createMemo(() => waterfallCols(frameW()))
  const cardWidth = createMemo(() => waterfallCardWidth(frameW(), cols()))
  const rowHeight = createMemo(() => waterfallRowHeight(cardWidth()))
  const rowCount = createMemo(() => Math.ceil(items().length / cols()))
  // The toolbar floats above the content, so the top reserves its height plus the card
  // padding: the first card starts below the bar instead of under it.
  const topPad = createMemo(() => props.topOffset() + VIEW_PAD)
  const contentHeight = createMemo(() => rowCount() * rowHeight() + topPad())

  const firstRow = createMemo(() => Math.max(0, Math.floor(scrollTop() / rowHeight())))
  const lastRow = createMemo(() => Math.min(rowCount(), Math.ceil((scrollTop() + viewportH()) / rowHeight())))
  const renderStart = createMemo(() => Math.max(0, firstRow() - OVERSCAN_ROWS))
  const renderEnd = createMemo(() => Math.min(rowCount(), lastRow() + OVERSCAN_ROWS))

  const preview = createPreviewController()
  // A thumb dragged along the track replaces the whole window of cards every few frames, so the
  // pictures hold until the motion settles. draw/scrollMotion.ts holds the rule and the window.
  const [fastMotion, setFastMotion] = createSignal(false)
  const motion = createScrollMotion(setFastMotion)

  let raf = 0
  // Scroll fires several times per frame, so the signal is written once per frame and the
  // layout memos run once instead of once per event.
  const onScroll = () => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      setScrollTop(window.scrollY)
      motion.step(window.scrollY, performance.now())
      updatePreview()
    })
  }

  // A classic scrollbar sits between the edge and the chip, so the chip leaves room for it.
  // Overlay bars (iOS, and macOS by default) report no width, so the chip uses VIEW_PAD.
  const barGap = () => {
    const bar = window.innerWidth - document.documentElement.clientWidth
    return bar > 0 ? bar + PREVIEW_SCROLLBAR_GAP : VIEW_PAD
  }

  const updatePreview = () => {
    // How far the page can scroll. The browser measures this, and its answer includes the band
    // under the last row, whose height follows the text it holds. Reading the number once per
    // frame here means nothing else has to reserve a height for that band.
    const s = Math.max(0, document.documentElement.scrollHeight - viewportH())
    const top = previewTop(scrollTop(), s, viewportH(), PREVIEW_H)
    // No room for the chip: the page is barely one screen of scroll. Nothing is drawn, and a chip
    // that is already up fades on its own.
    if (top === null) return
    // The content starts below the floating toolbar, so the row at the top of the window is the
    // one covering (scrollY - topPad). ScrollY on its own points at a card one row lower.
    const row = Math.floor(Math.max(0, scrollTop() - topPad()) / rowHeight())
    const index = indexOfRow(row, cols(), items().length)
    preview.sync(orderLabel({
      item: items()[index], day: publishDayAt(items(), index),
      ranked: semanticActive(), sort: sortMode(),
    }), top, barGap())
  }

  // A sort can change while the chip is up, between two scroll frames, and the label on screen
  // would be the old order's answer. Scroll alone cannot catch that.
  createEffect(on(semanticActive, (ranked) => { if (ranked) preview.hide() }))

  onMount(() => {
    window.addEventListener('scroll', onScroll, { passive: true })
    onCleanup(() => {
      window.removeEventListener('scroll', onScroll)
      motion.dispose()
    })
  })

  createScrollRestore({
    scrollToTop: (target) => window.scrollTo(0, target),
    items, cols, rowHeight, setScrollTop, firstRow, scrollTop,
    firstVisibleId, setFirstVisibleId, persistSession,
  })

  // A filter change starts the list from the top. The store slot is written here rather than in
  // the body, because the body runs on every render.
  onMount(() => setOnFilterChange(() => {
    window.scrollTo(0, 0)
    setScrollTop(0)
  }))
  onCleanup(() => setOnFilterChange(null))

  return (
    <>
      {/* Normal document flow, for the reason stated above. */}
      <div class="relative w-full" style={{ height: `${contentHeight()}px`, 'padding-top': `${topPad()}px`, 'padding-right': `calc(${VIEW_PAD}px + var(--safe-right))`,
        'padding-left': `calc(${VIEW_PAD}px + var(--safe-left))` }}>
        <div
          class="virtual-content"
          style={{
            position: 'relative',
            transform: `translateY(${renderStart() * rowHeight()}px)`,
            width: `${cols() * cardWidth() + GAP * (cols() - 1)}px`,
            height: `${(renderEnd() - renderStart()) * rowHeight()}px`,
          }}
        >
          <VirtualCards
            items={items}
            start={renderStart}
            end={renderEnd}
            cols={cols}
            cardWidth={cardWidth}
            rowHeight={rowHeight}
            onOpen={props.onOpen}
            hold={fastMotion}
          />
        </div>
      </div>
      {/* The band under the last row is in normal flow, so its height follows the text it
          holds: the copyright line wraps to two lines on a phone and one line on a desktop. */}
      <Show when={items().length === 0}>
        <EmptyState />
      </Show>
      <div class="w-full text-center text-sm text-muted px-6 py-5 border-t border-border">
        {tr('band.copyright')}
        <div class="mt-1.5">
          {tr('band.codeBefore')}{' '}
          <a
            href="https://github.com/wanderingmeow/furmony-gallery/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            class="text-accent-soft hover:underline"
          >
            {tr('band.license')}
          </a>{' '}
          {tr('band.codeAfter')} ·{' '}
          <a
            href="https://github.com/wanderingmeow/furmony-gallery"
            target="_blank"
            rel="noopener noreferrer"
            class="text-accent-soft hover:underline"
          >
            {tr('band.repository')}
          </a>
        </div>
      </div>

      {/* The chip is fixed to the viewport: the document scrolls, so an absolute chip would
          scroll away with the cards. pointer-events-none keeps it out of scroll and drag. */}
      <Show when={preview.preview()}>
        {(p) => (
          <div
            // z-50 sits above the toolbar (z-40). opacity-0 is the fade-out
            class="fixed z-50 glass rounded-lg px-3 py-2 text-sm font-semibold tabular-nums shadow pointer-events-none transition-opacity duration-300"
            classList={{ 'opacity-0': preview.leaving() }}
            style={{ top: `${p().top}px`, right: `${p().right}px` }}
          >
            {p().label}
          </div>
        )}
      </Show>

      <FloatingActions
        scrollTop={scrollTop}
        // smooth, because the scroll events it fires keep the preview chip in step
        onTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />
    </>
  )
}

// The chip's show and fade state. `sync` runs on every scroll frame, and the fade starts
// PREVIEW_IDLE_MS after the last one. The element unmounts only when the fade ends, and a new
// scroll cancels a pending fade instead of restarting it, which would read as a blink.
function createPreviewController() {
  const [preview, setPreview] = createSignal<{ label: string; top: number; right: number } | null>(null)
  const [leaving, setLeaving] = createSignal(false)
  let hideTimer: number | null = null
  let fadeTimer: number | null = null

  const update = (label: string, top: number, right: number) => {
    setPreview({ label, top, right })
    setLeaving(false)
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null }
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      hideTimer = null
      setLeaving(true)
      fadeTimer = setTimeout(() => {
        fadeTimer = null
        setPreview(null)
        setLeaving(false)
      }, PREVIEW_FADE_MS)
    }, PREVIEW_IDLE_MS)
  }
  /** Hide the chip now. The fade is skipped, and both timers are cleared. */
  const hide = () => {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null }
    setLeaving(false)
    setPreview(null)
  }
  /** Draw the chip. An empty label means this order has nothing to read out, so the chip hides. */
  const sync = (label: string, top: number, right: number) => {
    if (label === '') hide()
    else update(label, top, right)
  }
  onCleanup(() => hide())
  return { preview, leaving, sync, hide }
}

// Restores the saved top row once per mount, then keeps it saved. It is a function rather
// than inline code so the timers and the cleanup do not sit in the component.
function createScrollRestore(args: {
  scrollToTop: (target: number) => void
  items: () => AdoptListing[]
  cols: () => number
  rowHeight: () => number
  setScrollTop: (v: number) => void
  firstRow: () => number
  scrollTop: () => number
  firstVisibleId: () => number | null
  setFirstVisibleId: (v: number | null) => void
  persistSession: (id: number | null) => void
}) {
  // The restore runs once per page visit, so `done` is a local: every remount starts with a fresh
  // one.
  let done = false
  createEffect(
    on([args.firstVisibleId, args.items, args.cols, args.rowHeight], ([id, items, cols, rowHeight]) => {
      if (done || id == null || cols <= 0 || rowHeight <= 0 || items.length === 0) return
      done = true
      const row = rowOfIndex(findIndex(items, id), cols)
      // The saved row sat at y=topPad when it was captured, and the content's padding-top
      // still provides that offset, so the target is row*rowHeight with NO topPad. Adding
      // it would land the card at y=0, behind the toolbar.
      const target = row * rowHeight
      args.scrollToTop(target)
      args.setScrollTop(target)
    }),
  )

  // At the top (row <= 0) any saved position is dropped, so a refresh lands at the top
  // instead of returning to the previous spot.
  const saveRow = (row: number) => {
    if (row <= 0) {
      if (args.firstVisibleId() != null) {
        args.setFirstVisibleId(null)
        args.persistSession(null)
      }
      return
    }
    const item = args.items()[indexOfRow(row, args.cols(), args.items().length)]
    if (item) {
      args.setFirstVisibleId(item.adoptId)
      args.persistSession(item.adoptId)
    }
  }

  // Depends on firstRow, which changes at row boundaries only, so the body does not run on
  // every scroll frame.
  let saveTimer: number | null = null
  createEffect(on(args.firstRow, () => {
    // Read the row inside the timer: a value captured here could go stale and clear or save
    // the wrong row.
    if (saveTimer) return
    saveTimer = setTimeout(() => {
      saveTimer = null
      saveRow(args.firstRow())
    }, SAVE_THROTTLE_MS)
  }))
  onCleanup(() => {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
    // final save on exit - read the CURRENT scrollTop (the memo may be mid-disposal)
    saveRow(Math.floor(args.scrollTop() / args.rowHeight()))
  })
}

// Solid's <For> matches rows by object identity, so a row that comes back as the same object
// keeps its card and its DOM node wherever the row moves. Scroll and drag only write top/left,
// and a cover keeps the picture it already decoded: a card that remounted would load its cover
// again, and the reader sees it arrive. Only cards entering the window mount.
function VirtualCards(props: {
  items: () => AdoptListing[]; start: () => number; end: () => number; cols: () => number
  cardWidth: () => number; rowHeight: () => number; onOpen: (id: number) => void
  hold: () => boolean
}) {
  const first = () => props.start() * props.cols()
  const count = () => (props.end() - props.start()) * props.cols()
  const visible = createMemo(() => props.items().slice(first(), first() + count()))
  return (
    // The index <For> hands over is the offset inside this slice, so no offset map is
    // rebuilt when a row boundary changes.
    <For each={visible()}>
      {(l, i) => (
        <CardSlot
          listing={l}
          offset={() => i()}
          cols={props.cols}
          cardWidth={props.cardWidth}
          rowHeight={props.rowHeight}
          onOpen={props.onOpen}
          hold={props.hold}
        />
      )}
    </For>
  )
}

function CardSlot(props: {
  listing: AdoptListing; offset: () => number; cols: () => number; cardWidth: () => number; rowHeight: () => number; onOpen: (id: number) => void
  hold: () => boolean
}) {
  const row = () => Math.floor(props.offset() / props.cols())
  const col = () => props.offset() % props.cols()
  return (
    <div
      style={{
        position: 'absolute',
        top: `${row() * props.rowHeight()}px`,
        left: `${col() * (props.cardWidth() + GAP)}px`,
        width: `${props.cardWidth()}px`,
      }}
    >
      <button class="text-left" onClick={() => props.onOpen(props.listing.adoptId)}>
        <ListingCard listing={props.listing} width={props.cardWidth()} hold={props.hold} />
      </button>
    </div>
  )
}
