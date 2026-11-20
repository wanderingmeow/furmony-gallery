import { createSignal, lazy, onMount, Show, Suspense } from 'solid-js'
import { Router, Route, useMatch, useNavigate } from '@solidjs/router'
import { detailPattern, detailRoute, homePath, indexRoute, routerBase, statsPattern, statsRoute } from './router'
import { initStore } from './initStore'
import { flushUrlMapOnExit, initImageUrlMap } from './data/image'
import { Home } from './routes/Home'
import { Sheet } from './components/sheet/Sheet'
import { StatsSheet } from './components/stats/StatsSheet'
import { SheetBodySkeleton } from './components/sheet/SheetSkeleton'
import { BOX } from './draw/layout'
import { DETAIL_PAD_X } from './draw/layout'
import type { LockFilter } from './model/statistics'
import { NotificationCenter } from './components/ui/NotificationCenter'
import { tr } from './i18n'
import { Alert } from './components/ui/Alert'
import { loadData, loadError, setLoadError } from './stores/listingsStore'

const StatsLazy = lazy(() => import('./routes/Stats').then((m) => ({ default: m.Stats })))
const DetailLazy = lazy(() => import('./routes/Detail').then((m) => ({ default: m.Detail })))


function Shell() {
  const navigate = useNavigate()
  const detailMatch = useMatch(() => detailPattern)
  const isDetailOpen = () => !!detailMatch()
  const statsMatch = useMatch(() => statsPattern)
  const isStatsOpen = () => !!statsMatch()
  // The lock filter lives here, not inside the screen, so the header and the charts share
  // one value and it survives opening and closing the sheet.
  const [mode, setMode] = createSignal<LockFilter>('all')
  const closeSheet = () => navigate(homePath(), { scroll: false })

  onMount(() => {
    // The saved image URLs load first, so the listings that follow find the cache warm.
    initImageUrlMap().then(() => initStore())
    flushUrlMapOnExit()
  })
  return (
    <>
      {/* Home stays mounted behind the sheets: the backdrop blurs the real list, and its
          scroll position is there when a sheet closes. */}
      <Home />
      <StatsSheet open={isStatsOpen} onDismiss={closeSheet} mode={mode} setMode={setMode}>
        {(dismiss) => (
          // The header waits for the chunk too, so the placeholder paints the ✕.
          <Suspense fallback={<SheetBodySkeleton onClose={dismiss} />}>
            <StatsLazy mode={mode} onClose={dismiss} />
          </Suspense>
        )}
      </StatsSheet>
      <Sheet open={isDetailOpen} onDismiss={closeSheet}>
        {(dismiss) => (
          <Suspense
            fallback={
              <SheetBodySkeleton onClose={dismiss} pad={BOX.sheet.bodyPad} padX={DETAIL_PAD_X} />
            }
          >
            <DetailLazy onClose={dismiss} />
          </Suspense>
        )}
      </Sheet>
      {/* One column for both, so the notification center and the banner stack instead of
          overlapping. */}
      <div class="fixed z-50 flex flex-col items-end gap-2 top-[calc(0.75rem+var(--safe-top))]
        right-[calc(1rem+var(--safe-right))]">
        <NotificationCenter />
          <Show when={loadError()}>
            {(error) => (
              <Alert
                title={error().title}
                line={error().line}
                onClose={() => setLoadError(null)}
                class="w-[min(20rem,calc(100vw-2rem))]"
              >
                {/* The banner names what failed. This is the way out of it. */}
                <button
                  class="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-semibold whitespace-nowrap text-red-700 active:bg-red-100 dark:border-red-800 dark:bg-red-900 dark:text-red-200 dark:active:bg-red-800"
                  onClick={() => { setLoadError(null); void loadData() }}
                >{tr('common.retry')}</button>
              </Alert>
            )}
          </Show>
        </div>
    </>
  )
}

export default function App() {
  return (
    <Router root={Shell} base={routerBase}>
      <Route path={indexRoute} />
      <Route path={detailRoute} />
      <Route path={statsRoute} />
    </Router>
  )
}
