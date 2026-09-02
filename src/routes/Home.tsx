import { Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import {
  dataReady, fetchFailed, errorMessage, setErrorMessage,
} from '../store'
import { Toolbar } from '../components/Toolbar'
import { Waterfall } from '../components/Waterfall'

export function Home() {
  const navigate = useNavigate()

  // open detail — no URL query carry: filters/scroll state live in the in-memory store,
  // so nothing pollutes the browser history (every scroll/filter/search used to push a
  // new query entry and flooded the history stack).
  const onOpen = (id: number) => navigate(`/detail/${id}`)

  // no cache → full-screen loader until first data arrives (cache → immediate render)
  return (
    <Show when={dataReady() || fetchFailed()} fallback={<Loader />}>
      <div class="fixed inset-0 flex flex-col bg-canvas">
        <Toolbar />
        <div class="flex-1 min-h-0 relative">
          <Show when={errorMessage()}>
            <div class="absolute top-3 left-1/2 -translate-x-1/2 z-20 glass rounded-lg px-3 py-1.5 text-sm text-red-700 shadow flex items-center gap-2">
              {errorMessage()}
              <button class="text-xs text-muted" onClick={() => setErrorMessage(null)}>关闭</button>
            </div>
          </Show>
          <Waterfall onOpen={onOpen} />
        </div>
      </div>
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
