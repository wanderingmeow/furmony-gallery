import { createSignal, lazy, onMount, Suspense } from 'solid-js'
import { Router, Route, useMatch, useNavigate, useSearchParams } from '@solidjs/router'
import { initStore, setNoSocialOnly } from './store'
import { flushUrlMapOnExit, initImageUrlMap } from './data/image'
import { Home } from './routes/Home'
import { Sheet } from './components/sheet/Sheet'
import { StatsSheet } from './components/stats/StatsSheet'
import { SheetBodySkeleton } from './components/sheet/SheetSkeleton'
import { DETAIL_BODY } from './components/ui/boxes'
import { DETAIL_PAD_X } from './draw/layout'
import type { LockFilter } from './model/statistics'
import { NotificationCenter } from './components/ui/NotificationCenter'

const StatsLazy = lazy(() => import('./routes/Stats').then((m) => ({ default: m.Stats })))
const DetailLazy = lazy(() => import('./routes/Detail').then((m) => ({ default: m.Detail })))

// The router base takes no trailing slash: a base that ends in '/' turns /detail into
// `//detail`.
const routerBase = import.meta.env.BASE_URL.replace(/\/+$/, '')

// The routes are no-ops: they keep the URL, deep links and the back button working, while
// Shell reads the path and decides which sheet is open.
function Shell() {
  const navigate = useNavigate()
  // This router version keeps `location.pathname` base-prefixed, so the match pattern needs
  // the base too.
  const detailMatch = useMatch(() => `${routerBase}/detail/:id`)
  const isDetail = () => !!detailMatch()
  const statsMatch = useMatch(() => `${routerBase}/stats`)
  const isStats = () => !!statsMatch()
  // The lock filter lives here, not inside the screen, so the header and the charts share
  // one value and it survives opening and closing the sheet.
  const [mode, setMode] = createSignal<LockFilter>('all')
  const closeSheet = () => navigate('/', { scroll: false })
  // ?nosocial=1 is a debugging filter for listings with no social account, to find adoptIds
  // that still need a socials.json entry. The URL is read once, then the store owns the flag.
  const [searchParams] = useSearchParams()

  onMount(() => {
    setNoSocialOnly(searchParams.nosocial === '1')
    // The saved image URLs load first, so the listings that follow find the cache warm.
    initImageUrlMap().then(() => initStore())
    flushUrlMapOnExit()
  })
  return (
    <>
      {/* Home stays mounted behind the sheets: the backdrop blurs the real list, and its
          scroll position is there when a sheet closes. */}
      <Home />
      <StatsSheet open={isStats} onDismiss={closeSheet} mode={mode} setMode={setMode}>
        {(dismiss) => (
          // The header waits for the chunk too, so the placeholder paints the ✕.
          <Suspense fallback={<SheetBodySkeleton onClose={dismiss} />}>
            <StatsLazy mode={mode} onClose={dismiss} />
          </Suspense>
        )}
      </StatsSheet>
      <Sheet open={isDetail} onDismiss={closeSheet}>
        {(dismiss) => (
          <Suspense
            fallback={
              <SheetBodySkeleton onClose={dismiss} pad={DETAIL_BODY} padX={DETAIL_PAD_X} />
            }
          >
            <DetailLazy onClose={dismiss} />
          </Suspense>
        )}
      </Sheet>
      <NotificationCenter />
    </>
  )
}

export default function App() {
  return (
    <Router root={Shell} base={routerBase}>
      <Route path="/" />
      <Route path="/detail/:id" />
      <Route path="/stats" />
    </Router>
  )
}
