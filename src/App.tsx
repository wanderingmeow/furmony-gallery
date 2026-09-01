import { createEffect, createMemo, createSignal, onMount, Show } from 'solid-js'
import { Router, Route, useMatch, useNavigate } from '@solidjs/router'
import { initStore, setNavigator } from './store'
import { flushImageUrlMap, initImageUrlMap } from './cache'
import { Home } from './routes/Home'
import { Detail } from './routes/Detail'
import { NotificationCenter } from './components/NotificationCenter'

// router `base` is the mount path WITHOUT a trailing slash (Vite's BASE_URL ends with
// '/' — a trailing slash makes the router emit `base + /detail` → `//detail`).
const routerBase = import.meta.env.BASE_URL.replace(/\/+$/, '') || ''

// Root shell keeps the list (Home) always mounted, so the iOS sheet overlay can
// blur the real content behind it. Routes are no-ops: they only keep the URL /
// deep-link / back-button working; Shell decides what to render from the path.
function Shell() {
  const navigate = useNavigate()
  // This @solidjs/router version keeps `location.pathname` base-prefixed, so the match
  // pattern must include the base too (route branches are created base-prefixed).
  const detailMatch = useMatch(() => `${routerBase}/detail/:id`)
  const isDetail = () => !!detailMatch()

  // show is a pure derivation of the route — memo, not a signal (no effect-written
  // signal feedback loop). closing is transient animation state (imperative via exit()).
  const show = createMemo(() => isDetail())
  const [closing, setClosing] = createSignal(false)

  // reset the slide-out animation when the sheet (re)opens so it slides IN again.
  // writes only closing, never reads it → no reactive feedback.
  createEffect(() => {
    if (show()) setClosing(false)
  })

  // exit: play the slide-out, then actually navigate back & drop the overlay
  function exit() {
    setClosing(true)
    setTimeout(() => navigate('/'), 380) // >= sheet-out duration so it fully leaves before unmount
  }

  onMount(() => {
    initImageUrlMap()
    initStore()
    window.addEventListener('beforeunload', flushImageUrlMap)
  })
  createEffect(() => setNavigator((p: string) => navigate(p)))

  return (
    <>
      <Home />
      <Show when={show()}>
        <div class="fixed inset-0 z-50">
          {/* dimmed, blurred backdrop — only outside the solid card */}
          <div
            class={`absolute inset-0 bg-black/30 backdrop-blur-md ${closing() ? 'overlay-fade-out' : 'overlay-fade-in'}`}
          />
          {/* sheet: solid white card slides up from bottom (in) / down (out)
              mobile → full-width/full-height iPhone-style modal; desktop → centered rounded card */}
          <div
            class={`absolute inset-0 flex items-center justify-center sm:px-6 sm:py-6 ${closing() ? 'sheet-out' : 'sheet-in'}`}
          >
            <div class="relative w-full h-full bg-white overflow-hidden sm:max-w-190 sm:h-[calc(100vh-3rem)] sm:rounded-2xl sm:shadow-2xl">
              <Detail onClose={exit} />
            </div>
          </div>
        </div>
      </Show>
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
