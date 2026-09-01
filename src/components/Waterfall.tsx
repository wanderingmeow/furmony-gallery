import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { ArrowUpOutlined, SyncOutlined } from '@ant-design/icons-svg'
import type { AdoptListing } from '../types'
import {
  filteredListings, lastVisibleId, setLastVisibleId, persistSession, restored, setRestored,
  newContent, clearNewContent, fetchFailed, loadData, sortMode,
} from '../store'
import { CARD_EXTRA_HEIGHT, THUMB_ASPECT, displayPrice } from '../utils'
import { ListingCard } from './ListingCard'
import { AntIcon } from './AntIcon'

const VIEW_PAD = 16
const GAP = 16
const MIN_CARD = 280
const OVERSCAN_ROWS = 6
const FOOTER_H = 72 // copyright footer under the last row

export function Waterfall(props: { onOpen: (id: number) => void }) {
  let scroller!: HTMLDivElement
  const [viewportW, setViewportW] = createSignal(0)
  const [viewportH, setViewportH] = createSignal(0)
  const [scrollTop, setScrollTop] = createSignal(0)

  // reset per-mount so scroll restores on return to `/`
  setRestored(false)

  // ResizeObserver for container dims
  onMount(() => {
    const ro = new ResizeObserver(() => {
      setViewportW(scroller.clientWidth)
      setViewportH(scroller.clientHeight)
    })
    ro.observe(scroller)
    setViewportW(scroller.clientWidth)
    setViewportH(scroller.clientHeight)
    onCleanup(() => ro.disconnect())
  })

  // rAF-coalesced scroll handler: pointermove/scroll fire many times per frame;
  // apply scrollTop once per frame so the reactive layout memos run once, not per event.
  let raf = 0
  const onScroll = () => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      setScrollTop(scroller.scrollTop)
    })
  }

  const items = filteredListings

  const cols = createMemo(() => {
    const w = viewportW()
    if (w <= 0) return 2
    return Math.max(2, Math.floor((w - 2 * VIEW_PAD) / MIN_CARD))
  })

  const cardWidth = createMemo(() => {
    const c = cols()
    return (viewportW() - 2 * VIEW_PAD - GAP * (c - 1)) / c
  })

  const cardHeight = createMemo(() => cardWidth() / THUMB_ASPECT + CARD_EXTRA_HEIGHT)
  const rowHeight = createMemo(() => cardHeight() + GAP)
  const rowCount = createMemo(() => Math.ceil(items().length / cols()))
  const contentHeight = createMemo(() => rowCount() * rowHeight() + VIEW_PAD + FOOTER_H)
  const scrollHeight = createMemo(() => Math.max(0, contentHeight() - viewportH()))

  const firstRow = createMemo(() => Math.max(0, Math.floor(scrollTop() / rowHeight())))
  const lastRow = createMemo(() => Math.min(rowCount(), Math.ceil((scrollTop() + viewportH()) / rowHeight())))
  const renderStart = createMemo(() => Math.max(0, firstRow() - OVERSCAN_ROWS))
  const renderEnd = createMemo(() => Math.min(rowCount(), lastRow() + OVERSCAN_ROWS))

  // ---- scroll restoration (once) ----
  createEffect(() => {
    const id = lastVisibleId()
    const ready = cols() > 0 && rowHeight() > 0 && items().length > 0
    if (ready && id != null && !restored()) {
      setRestored(true)
      const idx = findIndex(items(), id, sortMode())
      const row = Math.floor(Math.max(0, idx) / cols())
      const target = VIEW_PAD + row * rowHeight()
      scroller.scrollTop = target
      setScrollTop(target)
    }
  })

  // ---- persist top visible id (throttled) ----
  // depend on firstRow (changes only on row boundaries), not scrollTop, so the
  // effect body doesn't re-run on every scroll frame.
  let saveTimer: number | null = null
  createEffect(() => {
    const row = firstRow()
    if (row <= 0) return
    if (saveTimer) return
    saveTimer = setTimeout(() => {
      saveTimer = null
      const idx = Math.min(row * cols(), items().length - 1)
      const item = items()[Math.max(0, idx)]
      if (item) {
        setLastVisibleId(item.adoptId)
        persistSession()
      }
    }, 2000)
  })
  onCleanup(() => { if (saveTimer) clearTimeout(saveTimer) })

  // save scroll position when navigating away
  onCleanup(() => {
    const top = scrollTop()
    if (top > 0 && items().length > 0) {
      const row = Math.floor(top / rowHeight())
      const idx = Math.min(row * cols(), items().length - 1)
      const item = items()[Math.max(0, idx)]
      if (item) {
        setLastVisibleId(item.adoptId)
        persistSession()
      }
    }
  })

  const showScrollbar = () => viewportH() > 0 && scrollHeight() > 0

  return (
    <div class="relative h-full w-full overflow-hidden">
      <div
        ref={scroller}
        class="vscroll h-full w-full"
        onScroll={onScroll}
        style={{ 'overflow-anchor': 'none' }}
      >
        {/* relative → the absolute footer anchors to the scroll content, not the viewport.
            no bottom padding so the copyright band reaches the very bottom (no gray strip) */}
        <div class="relative" style={{ height: `${contentHeight()}px`, width: '100%', 'padding-top': `${VIEW_PAD}px`, 'padding-right': `${VIEW_PAD}px`, 'padding-bottom': '0', 'padding-left': `${VIEW_PAD}px` }}>
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
          {/* copyright footer pinned below the last row */}
          <div
            class="absolute left-0 right-0 flex items-center justify-center text-center text-sm text-gray-500 px-6 py-5 border-t border-black/10"
            style={{ top: `${VIEW_PAD + rowCount() * rowHeight()}px` }}
          >
            所有图片与文字素材均源自 Furmony（furmony.com），版权归原作者所有；本页面仅作浏览展示，不用于商业用途。
          </div>
        </div>
      </div>

      <Show when={showScrollbar()}>
        <ScrollBar
          viewportH={viewportH}
          contentHeight={contentHeight}
          scrollTop={scrollTop}
          rowHeight={rowHeight}
          cols={cols}
          items={items}
          setScroll={(top) => { scroller.scrollTop = top; setScrollTop(top) }}
        />
      </Show>

      <BackToTop
        scrollTop={scrollTop}
        onTop={() => {
          // animated smooth scroll — scroll events drive scrollTop so the custom
          // right-edge scrollbar/thumb follows the animation
          scroller.scrollTo({ top: 0, behavior: 'smooth' })
          clearNewContent()
        }}
      />
    </div>
  )
}

// Flat, identity-keyed card list with absolute positioning. Cards are keyed by
// their listing object, so when content shifts during scroll/drag a listing keeps
// its DOM slot and just MOVES (top/left update) — it never unmounts/re-mounts,
// and its <img> never reloads. Only cards entering/leaving the window mount.
// This kills the Safari drag flash (was ~815 mounts + 366 image loads per drag).
function VirtualCards(props: {
  items: () => AdoptListing[]; start: () => number; end: () => number; cols: () => number
  cardWidth: () => number; rowHeight: () => number; onOpen: (id: number) => void
}) {
  const first = () => props.start() * props.cols()
  const count = () => (props.end() - props.start()) * props.cols()
  const visible = createMemo(() => props.items().slice(first(), first() + count()))
  return (
    // `<For>` second arg is the reactive slice index = offset within the visible
    // window — no offsets Map allocation on every row-boundary change.
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

// ---- Right-edge iOS-Contacts-style scrollbar with drag preview ----
function ScrollBar(props: {
  viewportH: () => number; contentHeight: () => number; scrollTop: () => number; rowHeight: () => number; cols: () => number
  items: () => AdoptListing[]; setScroll: (top: number) => void
}) {
  const trackH = () => props.viewportH()
  const scrollH = () => props.contentHeight() - props.viewportH()
  const thumbH = () => Math.max(40, props.viewportH() * (props.viewportH() / props.contentHeight()))
  const thumbTop = () => (props.scrollTop() / Math.max(1, scrollH())) * (trackH() - thumbH())

  const [dragging, setDragging] = createSignal(false)
  const [preview, setPreview] = createSignal<{ label: string; top: number } | null>(null)

  let thumbEl!: HTMLDivElement
  let trackEl!: HTMLDivElement
  let dragStartY = 0
  let dragStartTop = 0
  let rafId: number | null = null
  let pendingTop = 0
  let pendingClientY = 0

  // preview label is bigger for finger-friendliness (px-3 py-2 text-sm ≈36px tall)
  const PREVIEW_H = 36

  // cache the track's page-space top once per drag — reading getBoundingClientRect on
  // every pointermove forces a synchronous layout flush and punches through the rAF
  // coalescing (the drag-lag culprit).
  let trackTop = 0
  const pointerTopAt = (base: number, clientY: number) => {
    const y = clientY - base
    return Math.max(0, Math.min(y - PREVIEW_H / 2, trackH() - PREVIEW_H)) // center on pointer
  }

  const previewLabel = (top: number): string => {
    const row = Math.floor(top / props.rowHeight())
    const idx = Math.min(row * props.cols(), props.items().length - 1)
    const item = props.items()[Math.max(0, idx)]
    if (!item) return ''
    const isPrice = sortMode() === 'priceAsc' || sortMode() === 'priceDesc'
    return isPrice ? `¥${Math.round(displayPrice(item))}` : `#${item.adoptId}`
  }

  const onDown = (e: PointerEvent) => {
    e.preventDefault()
    thumbEl.setPointerCapture(e.pointerId)
    dragStartY = e.clientY
    dragStartTop = props.scrollTop()
    pendingTop = dragStartTop
    pendingClientY = e.clientY
    trackTop = trackEl.getBoundingClientRect().top // one layout read per drag
    setDragging(true)
    setPreview({ label: previewLabel(dragStartTop), top: pointerTopAt(trackTop, e.clientY) })
  }

  const onMove = (e: PointerEvent) => {
    if (!dragging()) return
    const dy = e.clientY - dragStartY
    const top = dragStartTop + (dy / Math.max(1, trackH() - thumbH())) * scrollH()
    pendingTop = Math.max(0, Math.min(scrollH(), top))
    pendingClientY = e.clientY
    // onMove does NO layout reads / no heavy work — only accumulate. All
    // previewLabel/pointerTop work happens once per frame inside the rAF callback.
    if (rafId == null) {
      rafId = requestAnimationFrame(() => {
        rafId = null
        props.setScroll(pendingTop)
        setPreview({ label: previewLabel(pendingTop), top: pointerTopAt(trackTop, pendingClientY) })
      })
    }
  }

  const onUp = (e: PointerEvent) => {
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null }
    thumbEl.releasePointerCapture(e.pointerId)
    setDragging(false)
    setPreview(null)
  }

  onMount(() => {
    thumbEl.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    onCleanup(() => {
      thumbEl.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    })
  })

  return (
    <div ref={trackEl} class="absolute right-1 top-0 bottom-0 w-2 z-20 touch-none select-none">
      <div
        ref={thumbEl}
        class="absolute w-2 bg-black/20 rounded-full"
        style={{ height: `${thumbH()}px`, top: `${thumbTop()}px` }}
      />
      <Show when={preview()}>
        {(p) => (
          <div
            class="absolute right-2 z-20 glass rounded-lg px-3 py-2 text-sm font-semibold shadow"
            style={{ top: `${Math.min(p().top, trackH() - PREVIEW_H)}px` }}
          >
            {p().label}
          </div>
        )}
      </Show>
    </div>
  )
}

// ---- Bottom-right back-to-top / refresh button ----
function BackToTop(props: { scrollTop: () => number; onTop: () => void }) {
  const show = () => props.scrollTop() > 600 || fetchFailed()
  const isRefresh = fetchFailed
  return (
    <Show when={show()}>
      <button
        class="absolute bottom-4 right-4 z-10 w-10 h-10 rounded-full glass shadow flex items-center justify-center text-lg border border-black/10"
        onClick={() => {
          if (isRefresh()) loadData()
          else props.onTop()
        }}
        title={isRefresh() ? '刷新' : '回到顶部'}
      >
        <span class="relative flex items-center justify-center">
          <AntIcon icon={() => (isRefresh() ? SyncOutlined : ArrowUpOutlined)} />
          <Show when={newContent()}>
            <span class="absolute -top-1 -right-2 w-2.5 h-2.5 rounded-full bg-red-500" />
          </Show>
        </span>
      </button>
    </Show>
  )
}

// find nearest index of targetId in filtered list (fallback nearest by sort key)
function findIndex(items: AdoptListing[], targetId: number, sort: string): number {
  const i = items.findIndex((l) => l.adoptId === targetId)
  if (i >= 0) return i
  const target = items.find((l) => l.adoptId === targetId)
  if (!target) return 0
  const isPrice = sort === 'priceAsc' || sort === 'priceDesc'
  let best = 0
  let bestD = Infinity
  items.forEach((l, idx) => {
    const d = isPrice
      ? Math.abs(displayPrice(l) - displayPrice(target))
      : Math.abs((l.createTime ? Date.parse(l.createTime) : 0) - (target.createTime ? Date.parse(target.createTime) : 0))
    if (d < bestD) { bestD = d; best = idx }
  })
  return best
}
