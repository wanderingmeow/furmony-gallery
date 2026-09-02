import { createEffect, onMount } from 'solid-js'
import { Router, Route, useMatch, useNavigate } from '@solidjs/router'
import { initStore, setNavigator } from './store'
import { flushImageUrlMap, initImageUrlMap } from './image'
import { Home } from './routes/Home'
import { DetailSheet } from './components/DetailSheet'
import { NotificationCenter } from './components/NotificationCenter'

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

  onMount(() => {
    initImageUrlMap()
    initStore()
    window.addEventListener('beforeunload', flushImageUrlMap)
  })
  createEffect(() => setNavigator((p: string) => navigate(p)))

  return (
    <>
      <Home />
      <DetailSheet open={isDetail} onDismiss={() => navigate('/')} />
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
