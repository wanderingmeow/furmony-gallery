import { createEffect, createSignal, lazy, onMount } from 'solid-js'
import { Router, Route, useMatch, useNavigate } from '@solidjs/router'
import { initStore, setNavigator } from './store'
import { flushImageUrlMap, initImageUrlMap } from './image'
import { Home } from './routes/Home'
import { DetailSheet } from './components/DetailSheet'
import { StatsSheet } from './components/StatsSheet'
import type { LockFilter } from './statistics'
import { NotificationCenter } from './components/NotificationCenter'

// Stats page + uplot/@dschz/solid-uplot load ONLY when /stats is opened (code-split chunk).
const StatsLazy = lazy(() => import('./routes/Stats').then((m) => ({ default: m.Stats })))

// router `base` is the mount path WITHOUT a trailing slash (Vite's BASE_URL ends with
// '/' — a trailing slash makes the router emit `base + /detail` → `//detail`).
const routerBase = import.meta.env.BASE_URL.replace(/\/+$/, '') || ''

// Root shell keeps the list (Home) always mounted, so the iOS sheet overlay can
// blur the real content behind it. Routes are no-ops: they only keep the URL /
// deep-link / back-button working; Shell decides what to render from the path.
// The sheet itself (position, drag-to-dismiss gesture, backdrop) lives in
// DetailSheet.tsx — Shell only wires the route → open state and dismiss → navigate.
function Shell() {
  const navigate = useNavigate()
  // This @solidjs/router version keeps `location.pathname` base-prefixed, so the match
  // pattern must include the base too (route branches are created base-prefixed).
  const detailMatch = useMatch(() => `${routerBase}/detail/:id`)
  const isDetail = () => !!detailMatch()
  const statsMatch = useMatch(() => `${routerBase}/stats`)
  const isStats = () => !!statsMatch()
  // Lock filter state — lives here so StatsSheet (header, top-right) and the
  // stats content share the same filter; persists across open/close.
  const [mode, setMode] = createSignal<LockFilter>('all')

  onMount(() => {
    initImageUrlMap()
    initStore()
    window.addEventListener('beforeunload', flushImageUrlMap)
  })
  // navigate with scroll:false — @solidjs/router's navigate DEFAULTS scroll:true, which
  // makes it window.scrollTo(0,0) on EVERY navigation. Clicking a card (or a notification)
  // to open the sheet must NOT yank the waterfall to top; only the initial-load scroll
  // restore (createScrollRestore) is allowed to scroll.
  createEffect(() => setNavigator((p: string) => navigate(p, { scroll: false })))

  return (
    <>
      {/* Home stays mounted behind the sheets so the backdrop can blur it and its
          scroll is preserved (no jump) when returning from /stats. Stats opens as
          an iOS-style sheet; uplot + solid-uplot load lazily only when /stats opens. */}
      <Home />
      <StatsSheet open={isStats} onDismiss={() => navigate('/', { scroll: false })} mode={mode} setMode={setMode}>
        {(dismiss) => <StatsLazy mode={mode} onClose={dismiss} />}
      </StatsSheet>
      <DetailSheet open={isDetail} onDismiss={() => navigate('/', { scroll: false })} />
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
