import { createEffect, createMemo, createSignal, onCleanup, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { dataReady, fetchFailed } from '../stores/listingsStore'
import { Toolbar } from '../components/toolbar/Toolbar'
import { ToolbarSkeleton } from '../components/toolbar/ToolbarSkeleton'
import { Waterfall } from '../components/cards/Waterfall'
import { WaterfallSkeleton } from '../components/cards/WaterfallSkeleton'
import { skeletonForced, skeletonOverlay } from '../components/ui/skeletonView'
import { BAR_BOTTOM } from '../draw/layout'

export function Home() {
  const navigate = useNavigate()

  const topOffset = () => BAR_BOTTOM

  // Opening a card adds one history entry, so the back button pops it. Filters and scroll state
  // live in the store, so the URL carries nothing and the history stack stays short.
  // `scroll: false` keeps the reading position: the router scrolls the document to the top on
  // every navigation, and only the initial-load restore may scroll.
  const onOpen = (id: number) => navigate(`/detail/${id}`, { scroll: false })

  // Until the data lands, the bar and the list are both placeholders in the real boxes.
  const listReady = () => dataReady() || fetchFailed()

  // A placeholder says the reader is waiting, so it appears once the wait is real. A warm cache
  // answers within a few frames, and placeholders that come and go are only a flash.
  const SKELETON_DELAY_MS = 200
  const [slow, setSlow] = createSignal(false)
  createEffect(() => {
    if (listReady()) return
    const timer = setTimeout(() => setSlow(true), SKELETON_DELAY_MS)
    onCleanup(() => clearTimeout(timer))
  })

  // What the screen shows: `hold` while the document spinner covers it, `skeleton` for the
  // placeholders, `list` for the real screen, or `both` for the dev overlay.
  const view = createMemo(() => {
    if (skeletonOverlay()) return 'both' as const
    if (skeletonForced()) return 'skeleton' as const
    if (!listReady()) return slow() ? 'skeleton' : 'hold'
    return 'list' as const
  })

  const showSkeleton = () => view() === 'skeleton' || view() === 'both'
  const showList = () => view() === 'list' || view() === 'both'

  // The document spinner stays until the screen has something on it.
  createEffect(() => {
    if (view() !== 'hold') document.getElementById('boot-spinner')?.remove()
  })

  // While the placeholders are up, nothing sits below the fold, so the document cannot scroll. A
  // programmatic scroll still works, and the real list removes the lock.
  createEffect(() => {
    const root = document.documentElement
    root.style.overflow = view() === 'skeleton' ? 'hidden' : ''
    onCleanup(() => { root.style.overflow = '' })
  })

  // In overlay mode the placeholder bar sits above the real one (z-40), and the placeholder
  // grid stays under the cards.
  const overlayClass = (z: string) => (
    view() === 'both' ? `absolute inset-x-0 top-0 ${z} sk-overlay pointer-events-none` : ''
  )

  return (
    <>
      <div class="fixed top-0 inset-x-0 z-40 pointer-events-none">
        <Show when={showList()}>
          <Toolbar />
        </Show>
        <Show when={showSkeleton()}>
          <div class={overlayClass('z-50')}>
            <ToolbarSkeleton />
          </div>
        </Show>
      </div>
      <Show when={showSkeleton()}>
        <div class={overlayClass('z-30')}>
          <WaterfallSkeleton topOffset={topOffset} />
        </div>
      </Show>
      <Show when={showList()}>
        {/* The waterfall scrolls the document (html/body), so tapping the iOS status bar or the
            desktop Home key takes it to the top. The toolbar and the error chip are fixed and
            stay pinned while the cards move beneath. */}
        <Waterfall onOpen={onOpen} topOffset={topOffset} />
      </Show>
    </>
  )
}
