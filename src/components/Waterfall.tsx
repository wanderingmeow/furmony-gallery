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

  // row preview chip shown while scrolling (replaces the old drag-thumb preview)
  const [preview, setPreview] = createSignal<{ label: string; top: number } | null>(null)
  let hideTimer: number | null = null
  const PREVIEW_H = 36

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
      updatePreview()
    })
  }

  // compute the current row's preview chip + vertical position, show it, then
  // hide after ~700ms of no scrolling (idle). Called once per scroll frame.
  const updatePreview = () => {
    const s = scrollHeight()
    const h = viewportH()
    const top = s <= 0 ? 0 : (scrollTop() / s) * (h - PREVIEW_H)
    const row = Math.floor(Math.max(0, scrollTop()) / rowHeight())
    const idx = Math.min(row * cols(), items().length - 1)
    const item = items()[Math.max(0, idx)]
    const isPrice = sortMode() === 'priceAsc' || sortMode() === 'priceDesc'
    const label = item ? (isPrice ? `¥${Math.round(displayPrice(item))}` : `#${item.adoptId}`) : ''
    setPreview({ label, top })
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => setPreview(null), 700)
  }
  onCleanup(() => { if (hideTimer) clearTimeout(hideTimer) })

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
  // effect body doesn't re-run on every scroll frame. At the TOP (firstRow<=0) we
  // DROP any saved position (lastVisibleId=null) so a refresh lands at the top
  // instead of restoring the previous spot.
  let saveTimer: number | null = null
  createEffect(() => {
    if (saveTimer) return
    saveTimer = setTimeout(() => {
      saveTimer = null
      // read CURRENT firstRow at fire time, not the captured one — otherwise a
      // stale timer (e.g. started at top) could wrongly clear/save after scrolling
      const row = firstRow()
      if (row <= 0) {
        if (lastVisibleId() != null) {
          setLastVisibleId(null)
          persistSession()
        }
        return
      }
      const idx = Math.min(row * cols(), items().length - 1)
      const item = items()[Math.max(0, idx)]
      if (item) {
        setLastVisibleId(item.adoptId)
        persistSession()
      }
    }, 2000)
  })
  onCleanup(() => { if (saveTimer) clearTimeout(saveTimer) })

  // save scroll position when navigating away; at the top, drop it instead so a
  // refresh lands at the top
  onCleanup(() => {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
    const top = scrollTop()
    const row = Math.floor(top / rowHeight())
    if (row <= 0) {
      if (lastVisibleId() != null) {
        setLastVisibleId(null)
        persistSession()
      }
      return
    }
    if (items().length > 0) {
      const idx = Math.min(row * cols(), items().length - 1)
      const item = items()[Math.max(0, idx)]
      if (item) {
        setLastVisibleId(item.adoptId)
        persistSession()
      }
    }
  })

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
            class="absolute left-0 right-0 flex items-center justify-center text-center text-sm text-muted px-6 py-5 border-t border-border"
            style={{ top: `${VIEW_PAD + rowCount() * rowHeight()}px` }}
          >
            所有图片与文字素材均源自 Furmony（furmony.com），版权归原作者所有；本页面仅作浏览展示，不用于商业用途。
          </div>
        </div>
      </div>

      {/* row preview chip — pointer-events-none so it never blocks scroll/drag */}
      <Show when={preview()}>
        {(p) => (
          <div
            // right-4 (16px) == VIEW_PAD so the chip's right edge aligns with the cards'
            class="absolute right-4 z-20 glass rounded-lg px-3 py-2 text-sm font-semibold shadow pointer-events-none"
            style={{ top: `${Math.min(p().top, viewportH() - PREVIEW_H)}px` }}
          >
            {p().label}
          </div>
        )}
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

// ---- Bottom-right back-to-top / refresh button ----
function BackToTop(props: { scrollTop: () => number; onTop: () => void }) {
  const show = () => props.scrollTop() > 600 || fetchFailed()
  const isRefresh = fetchFailed
  return (
    <Show when={show()}>
      <button
        class="absolute bottom-4 right-4 z-10 w-10 h-10 rounded-full glass shadow flex items-center justify-center text-lg border border-border"
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
