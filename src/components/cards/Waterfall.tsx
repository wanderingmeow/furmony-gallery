import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import type { AdoptListing } from '../../model/types'
import {
  filteredListings, firstVisibleId, setFirstVisibleId, persistSession, restored, setRestored,
  sortMode, setOnFilterChange,
} from '../../store'
import {
  FOOTER_H, GAP, OVERSCAN_ROWS, PREVIEW_FADE_MS, PREVIEW_H, PREVIEW_IDLE_MS, VIEW_PAD,
  indexOfRow, rowOfIndex, waterfallCardWidth, waterfallCols, waterfallRowHeight,
} from '../../draw/layout'
import { displayPrice } from '../../model/domain'
import { SAVE_THROTTLE_MS, findIndex } from '../../draw/scrollRestore'
import { ListingCard } from './ListingCard'
import { FloatingActions } from '../fab/FloatingActions'

export function Waterfall(props: { onOpen: (id: number) => void; topOffset: () => number }) {
  // The list scrolls the document (html/body), not an inner div: tapping the iOS status bar
  // and pressing Home on a desktop both act on the document's main scrollable. So these
  // signals mirror window.scrollY and the window size.
  const [viewportW, setViewportW] = createSignal(document.documentElement.clientWidth)
  const [viewportH, setViewportH] = createSignal(window.innerHeight)
  const [scrollTop, setScrollTop] = createSignal(window.scrollY)

  // reset per-mount so scroll restores on return to `/`
  setRestored(false)

  const items = filteredListings
  const cols = createMemo(() => waterfallCols(viewportW()))
  const cardWidth = createMemo(() => waterfallCardWidth(viewportW(), cols()))
  const rowHeight = createMemo(() => waterfallRowHeight(cardWidth()))
  const rowCount = createMemo(() => Math.ceil(items().length / cols()))
  // The toolbar floats above the content, so the top reserves its height plus the card
  // padding: the first card starts below the bar instead of under it.
  const topPad = createMemo(() => props.topOffset() + VIEW_PAD)
  const contentHeight = createMemo(() => rowCount() * rowHeight() + topPad() + FOOTER_H)
  const maxScrollTop = createMemo(() => Math.max(0, contentHeight() - viewportH()))

  const firstRow = createMemo(() => Math.max(0, Math.floor(scrollTop() / rowHeight())))
  const lastRow = createMemo(() => Math.min(rowCount(), Math.ceil((scrollTop() + viewportH()) / rowHeight())))
  const renderStart = createMemo(() => Math.max(0, firstRow() - OVERSCAN_ROWS))
  const renderEnd = createMemo(() => Math.min(rowCount(), lastRow() + OVERSCAN_ROWS))

  const preview = createPreviewController()
  let raf = 0
  // Scroll fires several times per frame, so the signal is written once per frame and the
  // layout memos run once instead of once per event.
  const onScroll = () => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      setScrollTop(window.scrollY)
      updatePreview()
    })
  }

  // lastTopId is the id on the top visible row, tracked while scrolling: a sort change uses
  // it to stay on that card instead of jumping to the top.
  let lastTopId: number | null = null
  const updatePreview = () => {
    const s = maxScrollTop()
    const h = viewportH()
    const top = s <= 0 ? 0 : (scrollTop() / s) * (h - PREVIEW_H)
    const row = Math.floor(Math.max(0, scrollTop()) / rowHeight())
    const item = items()[indexOfRow(row, cols(), items().length)]
    lastTopId = item ? item.adoptId : null
    const isPrice = sortMode() === 'priceAsc' || sortMode() === 'priceDesc'
    const label = item ? (isPrice ? `¥${Math.round(displayPrice(item))}` : `#${item.adoptId}`) : ''
    preview.update(label, top)
  }

  onMount(() => {
    const onResize = () => {
      setViewportW(document.documentElement.clientWidth)
      setViewportH(window.innerHeight)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, { passive: true })
    onCleanup(() => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll)
    })
  })

  createScrollRestore({
    scrollToTop: (target) => window.scrollTo(0, target),
    items, cols, rowHeight, setScrollTop, firstRow, scrollTop,
    firstVisibleId, setFirstVisibleId, persistSession, restored, setRestored,
  })

  // A sort keeps the reader on the card they were looking at; any other filter change
  // starts over from the top.
  setOnFilterChange((kind) => {
    if (kind === 'sort') {
      const id = lastTopId
      if (id != null) {
        const row = rowOfIndex(findIndex(items(), id), cols())
        const target = row * rowHeight()
        window.scrollTo(0, target)
        setScrollTop(target)
      }
      return
    }
    window.scrollTo(0, 0)
    setScrollTop(0)
  })
  onCleanup(() => setOnFilterChange(null))

  return (
    <>
      {/* Normal document flow, for the reason on the signals above. The footer sits right
          after the last row, so no grey strip is left at the bottom. */}
      <div class="relative w-full" style={{ height: `${contentHeight()}px`, 'padding-top': `${topPad()}px`, 'padding-right': `${VIEW_PAD}px`, 'padding-left': `${VIEW_PAD}px` }}>
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
          />
        </div>
        <div
          class="absolute left-0 right-0 flex items-center justify-center text-center text-sm text-muted px-6 py-5 border-t border-border"
          style={{ top: `${topPad() + rowCount() * rowHeight()}px` }}
        >
          所有图片与文字素材均源自 Furmony（furmony.com），版权归原作者所有；本页面仅作浏览展示，不用于商业用途。
        </div>
      </div>

      {/* The chip is fixed to the viewport: the document scrolls, so an absolute chip would
          scroll away with the cards. pointer-events-none keeps it out of scroll and drag. */}
      <Show when={preview.preview()}>
        {(p) => (
          <div
            // z-50 sits above the toolbar (z-40); opacity-0 is the fade-out
            class="fixed z-50 glass rounded-lg px-3 py-2 text-sm font-semibold shadow pointer-events-none transition-opacity duration-300"
            classList={{ 'opacity-0': preview.leaving() }}
            style={{ top: `${Math.min(p().top, viewportH() - PREVIEW_H)}px`, right: `${VIEW_PAD}px` }}
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

// The chip's show and fade state: a scroll frame calls update(), and PREVIEW_IDLE_MS after
// the last one the fade starts. The element unmounts only when the fade ends, and a new
// scroll cancels a pending fade instead of restarting it, which would read as a blink.
function createPreviewController() {
  const [preview, setPreview] = createSignal<{ label: string; top: number } | null>(null)
  const [leaving, setLeaving] = createSignal(false)
  let hideTimer: number | null = null
  let fadeTimer: number | null = null

  const update = (label: string, top: number) => {
    setPreview({ label, top })
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
  onCleanup(() => {
    if (hideTimer) clearTimeout(hideTimer)
    if (fadeTimer) clearTimeout(fadeTimer)
  })
  return { preview, leaving, update }
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
  persistSession: () => void
  restored: () => boolean
  setRestored: (v: boolean) => void
}) {
  createEffect(() => {
    const id = args.firstVisibleId()
    const ready = args.cols() > 0 && args.rowHeight() > 0 && args.items().length > 0
    if (ready && id != null && !args.restored()) {
      args.setRestored(true)
      const row = rowOfIndex(findIndex(args.items(), id), args.cols())
      // The saved row sat at y=topPad when it was captured, and the content's padding-top
      // still provides that offset, so the target is row*rowHeight with NO topPad. Adding
      // it would land the card at y=0, behind the toolbar.
      const target = row * args.rowHeight()
      args.scrollToTop(target)
      args.setScrollTop(target)
    }
  })

  // At the top (row <= 0) any saved position is dropped, so a refresh lands at the top
  // instead of returning to the previous spot.
  const saveRow = (row: number) => {
    if (row <= 0) {
      if (args.firstVisibleId() != null) {
        args.setFirstVisibleId(null)
        args.persistSession()
      }
      return
    }
    const item = args.items()[indexOfRow(row, args.cols(), args.items().length)]
    if (item) {
      args.setFirstVisibleId(item.adoptId)
      args.persistSession()
    }
  }

  // Depends on firstRow, which changes at row boundaries only, so the body does not run on
  // every scroll frame.
  let saveTimer: number | null = null
  createEffect(() => {
    // Read the row inside the timer: a value captured here could go stale and clear or save
    // the wrong row.
    void args.firstRow()
    if (saveTimer) return
    saveTimer = setTimeout(() => {
      saveTimer = null
      saveRow(args.firstRow())
    }, SAVE_THROTTLE_MS)
  })
  onCleanup(() => {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
    // final save on exit — read the CURRENT scrollTop (the memo may be mid-disposal)
    saveRow(Math.floor(args.scrollTop() / args.rowHeight()))
  })
}

// A flat, identity-keyed list: every card is keyed by its listing object, so a card that
// moves during scroll or drag keeps its DOM slot and only updates top/left. It never
// unmounts and its <img> never reloads, which is what removed the Safari drag flash (was
// ~815 mounts and 366 image loads per drag). Only cards entering the window mount.
function VirtualCards(props: {
  items: () => AdoptListing[]; start: () => number; end: () => number; cols: () => number
  cardWidth: () => number; rowHeight: () => number; onOpen: (id: number) => void
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
        />
      )}
    </For>
  )
}

function CardSlot(props: {
  listing: AdoptListing; offset: () => number; cols: () => number; cardWidth: () => number; rowHeight: () => number; onOpen: (id: number) => void
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
        <ListingCard listing={props.listing} width={props.cardWidth()} />
      </button>
    </div>
  )
}
