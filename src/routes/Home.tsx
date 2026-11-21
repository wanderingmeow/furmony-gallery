import { createEffect, createMemo, createSignal, on, onCleanup, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { detailPath } from '../router'
import { dataReady, fetchFailed } from '../stores/listingsStore'
import { ListChrome } from '../components/chrome/ListChrome'
import { ChromeSkeleton } from '../components/chrome/ChromeSkeleton'
import { Waterfall } from '../components/cards/Waterfall'
import { WaterfallSkeleton } from '../components/cards/WaterfallSkeleton'
import { skeletonForced, skeletonOverlay } from '../components/ui/skeletonView'
import { appSheetReady } from '../draw/appSheet'
import { chromeTop } from '../draw/layout'
import { watchViewport } from '../components/ui/viewport'

export function Home() {
  const navigate = useNavigate()

  // The band keeps the room the search box takes at its tallest, so opening it never covers a row.
  const { safe } = watchViewport()
  const topOffset = () => chromeTop(safe().top)

  // Opening a card adds one history entry, so the back button pops it. Filters and scroll state
  // live in the store, so the URL carries nothing and the history stack stays short.
  // scroll: false, so the way to a card does not take the document to the top
  const onOpen = (id: number) => navigate(detailPath(id), { scroll: false })

  // Until the data lands, the bar and the list are both placeholders in the real boxes.
  const listReady = () => dataReady() || fetchFailed()

  // A placeholder says the user is waiting, so it appears once the wait is real. A warm cache
  // answers within a few frames, and placeholders that come and go are only a flash.
  const SKELETON_DELAY_MS = 200
  const [slow, setSlow] = createSignal(false)
  createEffect(on(listReady, (ready) => {
    if (ready) return
    const timer = setTimeout(() => setSlow(true), SKELETON_DELAY_MS)
    onCleanup(() => clearTimeout(timer))
  }))

  // What the screen shows: `hold` while the document spinner covers it, `skeleton` for the
  // placeholders, `list` for the real screen, or `both` for the dev overlay.
  const view = createMemo(() => {
    if (skeletonOverlay()) return 'both' as const
    if (skeletonForced()) return 'skeleton' as const
    // the data does not wait for the sheet: both travel at their own speed
    if (!appSheetReady()) return 'hold' as const
    if (!listReady()) return slow() ? 'skeleton' : 'hold'
    return 'list' as const
  })

  const showSkeleton = () => view() === 'skeleton' || view() === 'both'
  const showList = () => view() === 'list' || view() === 'both'

  // The document spinner stays until the screen has something on it.
  createEffect(on(view, (v) => {
    if (v === 'hold') return
    document.getElementById('boot-spinner')?.remove()
    document.getElementById('boot-error')?.remove()
  }))

  // While the placeholders are up, nothing sits below the fold, so the document cannot scroll. A
  // programmatic scroll still works, and the real list removes the lock.
  createEffect(on(view, (v) => {
    const root = document.documentElement
    root.style.overflow = v === 'skeleton' ? 'hidden' : ''
    onCleanup(() => { root.style.overflow = '' })
  }))

  // In overlay mode the placeholder grid stays under the cards.
  const overlayClass = (z: string) => (
    view() === 'both' ? `absolute inset-x-0 top-0 ${z} sk-overlay pointer-events-none` : ''
  )

  return (
    <>
      <Show when={showList()}>
        <ListChrome />
      </Show>
      <Show when={showSkeleton()}>
        <div class={overlayClass('z-30')}>
          <WaterfallSkeleton topOffset={topOffset} />
        </div>
      </Show>
      <Show when={showSkeleton()}>
        {/* The placeholder band stands where the real one will, at the bottom edge. In the dev
            overlay it sits on top of the band that is already there. */}
        <div class={view() === 'both' ? 'fixed inset-x-0 bottom-0 z-50 sk-overlay pointer-events-none' : ''}>
          <ChromeSkeleton />
        </div>
      </Show>
      <Show when={showList()}>
        {/* The waterfall scrolls the document (html/body), so tapping the iOS status bar or the
            desktop Home key takes it to the top. The band at the bottom edge is fixed and stays
            pinned while the cards move beneath it. */}
        <Waterfall onOpen={onOpen} topOffset={topOffset} />
      </Show>
    </>
  )
}
