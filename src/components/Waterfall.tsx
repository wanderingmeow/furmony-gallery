import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { ArrowUpOutlined, BarChartOutlined, SyncOutlined } from '@ant-design/icons-svg'
import { useNavigate } from '@solidjs/router'
import type { AdoptListing } from '../types'
import {
  filteredListings, firstVisibleId, setFirstVisibleId, persistSession, restored, setRestored,
  newContent, clearNewContent, fetchFailed, loadData, sortMode,
} from '../store'
import { CARD_EXTRA_HEIGHT, THUMB_ASPECT, FADE_MS, FOOTER_H, GAP, MIN_CARD, OVERSCAN_ROWS, PREVIEW_H, PREVIEW_IDLE_MS, SAVE_THROTTLE_MS, VIEW_PAD } from '../layout'
import { displayPrice } from '../domain'
import { findIndex } from '../scrollRestore'
import { ListingCard } from './ListingCard'
import { AntIcon } from './AntIcon'

export function Waterfall(props: { onOpen: (id: number) => void; topOffset: () => number }) {
  // The waterfall scrolls the DOCUMENT (html/body), not an inner div — the only way to
  // get iOS status-bar tap-to-top and the PC Home key (both target the document's main
  // scrollable). scrollTop mirrors window.scrollY; viewport dims come from the window.
  const [viewportW, setViewportW] = createSignal(document.documentElement.clientWidth)
  const [viewportH, setViewportH] = createSignal(window.innerHeight)
  const [scrollTop, setScrollTop] = createSignal(window.scrollY)

  // reset per-mount so scroll restores on return to `/`
  setRestored(false)

  // ---- derived geometry (memoized; run once per dependency change) ----
  const items = filteredListings
  const cols = createMemo(() => {
    const w = viewportW()
    if (w <= 0) return 2
    return Math.max(2, Math.floor((w - 2 * VIEW_PAD) / MIN_CARD))
  })
  const cardWidth = createMemo(() => (viewportW() - 2 * VIEW_PAD - GAP * (cols() - 1)) / cols())
  const cardHeight = createMemo(() => cardWidth() / THUMB_ASPECT + CARD_EXTRA_HEIGHT)
  const rowHeight = createMemo(() => cardHeight() + GAP)
  const rowCount = createMemo(() => Math.ceil(items().length / cols()))
  // topPad = floating toolbar height + card padding — reserved at the top so cards start
  // BELOW the bar (never hidden), while the toolbar stays a fixed overlay above.
  const topPad = createMemo(() => props.topOffset() + VIEW_PAD)
  const contentHeight = createMemo(() => rowCount() * rowHeight() + topPad() + FOOTER_H)
  const maxScrollTop = createMemo(() => Math.max(0, contentHeight() - viewportH()))

  const firstRow = createMemo(() => Math.max(0, Math.floor(scrollTop() / rowHeight())))
  const lastRow = createMemo(() => Math.min(rowCount(), Math.ceil((scrollTop() + viewportH()) / rowHeight())))
  const renderStart = createMemo(() => Math.max(0, firstRow() - OVERSCAN_ROWS))
  const renderEnd = createMemo(() => Math.min(rowCount(), lastRow() + OVERSCAN_ROWS))

  // ---- row preview chip (encapsulated show/fade state machine) ----
  const preview = createPreviewController()
  let raf = 0
  // rAF-coalesced scroll handler: scroll fires many times per frame; apply scrollTop
  // once per frame so the layout memos run once, not per event.
  const onScroll = () => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      setScrollTop(window.scrollY)
      updatePreview()
    })
  }
  // compute the current row's preview chip + vertical position, then show it (the
  // controller fades it out after PREVIEW_IDLE_MS of no scrolling).
  const updatePreview = () => {
    const s = maxScrollTop()
    const h = viewportH()
    const top = s <= 0 ? 0 : (scrollTop() / s) * (h - PREVIEW_H)
    const row = Math.floor(Math.max(0, scrollTop()) / rowHeight())
    const idx = Math.min(row * cols(), items().length - 1)
    const item = items()[Math.max(0, idx)]
    const isPrice = sortMode() === 'priceAsc' || sortMode() === 'priceDesc'
    const label = item ? (isPrice ? `¥${Math.round(displayPrice(item))}` : `#${item.adoptId}`) : ''
    preview.update(label, top)
  }

  // document is the scroll container — window resize/scroll drive the signals
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

  // ---- scroll restoration (once) + top-visible-id persistence ----
  createScrollRestore({
    scrollToTop: (target) => window.scrollTo(0, target),
    items, cols, rowHeight, setScrollTop, firstRow, scrollTop,
    firstVisibleId, setFirstVisibleId, persistSession, restored, setRestored,
  })

  return (
    <>
      {/* content lives in normal document flow so the document (html/body) scrolls it — this
          is what enables iOS status-bar tap-to-top + PC Home. padding-top (topPad) keeps the
          cards below the fixed toolbar; the footer reaches the very bottom (no gray strip). */}
      <div class="relative w-full" style={{ height: `${contentHeight()}px`, 'padding-top': `${topPad()}px`, 'padding-right': `${VIEW_PAD}px`, 'padding-bottom': '0', 'padding-left': `${VIEW_PAD}px` }}>
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
          style={{ top: `${topPad() + rowCount() * rowHeight()}px` }}
        >
          所有图片与文字素材均源自 Furmony（furmony.com），版权归原作者所有；本页面仅作浏览展示，不用于商业用途。
        </div>
      </div>

      {/* row preview chip — FIXED to the viewport (the document scrolls, so absolute would
          scroll away); pointer-events-none so it never blocks scroll/drag */}
      <Show when={preview.preview()}>
        {(p) => (
          <div
            // right-4 == VIEW_PAD; z-50 above the toolbar (z-40); opacity-0 = fade-out
            class="fixed right-4 z-50 glass rounded-lg px-3 py-2 text-sm font-semibold shadow pointer-events-none transition-opacity duration-300"
            classList={{ 'opacity-0': preview.leaving() }}
            style={{ top: `${Math.min(p().top, viewportH() - PREVIEW_H)}px` }}
          >
            {p().label}
          </div>
        )}
      </Show>

      <FloatingActions
        scrollTop={scrollTop}
        onTop={() => {
          // animated smooth scroll — window scroll events drive scrollTop so the preview
          // chip follows the animation
          window.scrollTo({ top: 0, behavior: 'smooth' })
          clearNewContent()
        }}
      />
    </>
  )
}

// ---- Row-preview controller ----
// Shows the `#id`/`¥price` chip while scrolling, fades it out after ~PREVIEW_IDLE_MS of
// idle. Encapsulates the show/leaving/timer state machine so Waterfall only calls
// update() on scroll frames. leaving() → opacity-0 (transition); unmount only after the
// fade completes; a new scroll cancels the pending fade (no animation-restart blink).
function createPreviewController() {
  const [preview, setPreview] = createSignal<{ label: string; top: number } | null>(null)
  const [leaving, setLeaving] = createSignal(false)
  let hideTimer: number | null = null
  let fadeTimer: number | null = null

  const update = (label: string, top: number) => {
    setPreview({ label, top })
    setLeaving(false) // cancel any pending fade — chip reappears on new scroll
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null }
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      hideTimer = null
      setLeaving(true) // fade out
      fadeTimer = setTimeout(() => {
        fadeTimer = null
        setPreview(null) // only now unmount — fade already done
        setLeaving(false)
      }, FADE_MS)
    }, PREVIEW_IDLE_MS)
  }
  onCleanup(() => {
    if (hideTimer) clearTimeout(hideTimer)
    if (fadeTimer) clearTimeout(fadeTimer)
  })
  return { preview, leaving, update }
}

// ---- Scroll restoration + persistence ----
// Restores the saved top-visible row once per mount; persists the current top row
// (throttled) and on cleanup. Kept in a hook so the imperative timer/cleanup logic
// doesn't sprawl in the component.
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
  // ---- restore (once) ----
  createEffect(() => {
    const id = args.firstVisibleId()
    const ready = args.cols() > 0 && args.rowHeight() > 0 && args.items().length > 0
    if (ready && id != null && !args.restored()) {
      args.setRestored(true)
      const idx = findIndex(args.items(), id)
      const row = Math.floor(Math.max(0, idx) / args.cols())
      // The saved row sat at viewport y=topPad when captured (the content's padding-top
      // already offsets cards below the toolbar). Restoring to row*rowHeight — NO topPad —
      // puts it back at y=topPad, visible below the bar; adding topPad would push it to
      // y=0 (hidden behind the toolbar).
      const target = row * args.rowHeight()
      args.scrollToTop(target)
      args.setScrollTop(target)
    }
  })

  // save the current top-visible row. At the TOP (row<=0) DROP any saved position so a
  // refresh lands at the top instead of restoring the previous spot.
  const saveRow = (row: number) => {
    if (row <= 0) {
      if (args.firstVisibleId() != null) {
        args.setFirstVisibleId(null)
        args.persistSession()
      }
      return
    }
    const idx = Math.min(row * args.cols(), args.items().length - 1)
    const item = args.items()[Math.max(0, idx)]
    if (item) {
      args.setFirstVisibleId(item.adoptId)
      args.persistSession()
    }
  }

  // ---- persist (throttled) ----
  // Depend on firstRow (changes only on row boundaries), not scrollTop, so the effect
  // body doesn't re-run on every scroll frame.
  let saveTimer: number | null = null
  createEffect(() => {
    // reactive dependency: re-run on row boundaries. Reading firstRow() here (void) keeps
    // the effect alive; the ACTUAL value is read fresh inside the timer callback so a
    // stale capture can never wrongly clear/save.
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

// ---- Bottom-right floating action group: back-to-top / refresh (above) + stats entry (always) ----
function FloatingActions(props: { scrollTop: () => number; onTop: () => void }) {
  // show the to-top button whenever the page is not at the top (screen-size aware,
  // not a fixed px — any scroll away from the top shows it); the stats entry stays.
  const show = () => props.scrollTop() > 0 || fetchFailed()
  const isRefresh = fetchFailed
  const navigate = useNavigate()
  // Scroll progress (0..1) for the back-to-top clock ring — top / total scrollable.
  const progress = createMemo(() => {
    const top = props.scrollTop()
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    return Math.min(1, Math.max(0, top / max))
  })
  return (
    <div class="fixed bottom-4 right-4 z-10 flex flex-col items-center gap-2">
      <Show when={show()}>
        <button
          class="float-progress cursor-pointer w-12 h-12 rounded-full bg-surface shadow shadow-neutral-600/40 flex items-center justify-center text-xl border border-border"
          style={{ '--float-btn-progress': `${progress()}turn` }}
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
      {/* stats entry — always visible, opens /stats (lazy chunk) */}
      <button
        class="cursor-pointer w-12 h-12 rounded-full shadow shadow-orange-500/40 flex items-center justify-center bg-orange-500 text-white border border-orange-600/40"
        onClick={() => navigate('/stats', { scroll: false })}
        title="数据统计"
      >
        <AntIcon icon={BarChartOutlined} />
      </button>
    </div>
  )
}
