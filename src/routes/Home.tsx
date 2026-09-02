import { createEffect, createSignal, onCleanup, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import {
  dataReady, fetchFailed, errorMessage, setErrorMessage,
} from '../store'
import { Toolbar } from '../components/Toolbar'
import { Waterfall } from '../components/Waterfall'

export function Home() {
  const navigate = useNavigate()

  // floating toolbar's bottom edge → waterfall reserves it at the top so cards start
  // BELOW the bar. Measured live (ResizeObserver) for toolbar height changes.
  // NOTE: measure in an EFFECT gated on dataReady — onMount fires while barWrap is
  // still null (loader showing), so getBoundingClientRect() would throw.
  const [topOffset, setTopOffset] = createSignal(0)
  let barWrap!: HTMLDivElement
  createEffect(() => {
    if (!dataReady() && !fetchFailed()) return
    const measure = () => setTopOffset(barWrap.getBoundingClientRect().bottom)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(barWrap)
    onCleanup(() => ro.disconnect())
  })

  // open detail — no URL query carry: filters/scroll state live in the in-memory store,
  // so nothing pollutes the browser history (every scroll/filter/search used to push a
  // new query entry and flooded the history stack).
  // scroll:false — @solidjs/router's navigate defaults scroll:true and scrolls the
  // document (the waterfall) to top on EVERY navigation. Opening a card must preserve
  // the user's current scroll; only the initial-load restore is allowed to scroll.
  const onOpen = (id: number) => navigate(`/detail/${id}`, { scroll: false })

  // no cache → full-screen loader until first data arrives (cache → immediate render)
  return (
    <Show when={dataReady() || fetchFailed()} fallback={<Loader />}>
      {/* The waterfall scrolls the DOCUMENT (html/body) — this makes iOS status-bar tap
          and the PC Home key scroll it to top. Toolbar + error chip are FIXED overlays
          that stay pinned while the document (cards) scrolls beneath. */}
      <Waterfall onOpen={onOpen} topOffset={topOffset} />
      {/* floating toolbar — fixed overlay, pointer-events pass through the wrapper */}
      <div ref={barWrap} class="fixed top-0 inset-x-0 z-40 pointer-events-none">
        <Toolbar />
      </div>
      <Show when={errorMessage()}>
        <div class="fixed top-3 left-1/2 -translate-x-1/2 z-50 glass rounded-lg px-3 py-1.5 text-sm text-red-700 shadow flex items-center gap-2">
          {errorMessage()}
          <button class="text-xs text-muted" onClick={() => setErrorMessage(null)}>关闭</button>
        </div>
      </Show>
    </Show>
  )
}

function Loader() {
  return (
    <div class="fixed inset-0 flex items-center justify-center bg-canvas">
      <div class="flex flex-col items-center gap-3 text-muted">
        <div class="w-10 h-10 rounded-full border-4 border-gray-300 border-t-blue-600 animate-spin" />
        <span class="text-sm">加载中…</span>
      </div>
    </div>
  )
}
