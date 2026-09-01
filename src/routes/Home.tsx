import { createEffect, Show } from 'solid-js'
import { useLocation, useNavigate, useSearchParams } from '@solidjs/router'
import {
  tab, setTab, sortMode, setSortMode, selectedColors, setSelectedColors,
  selectedRaces, setSelectedRaces, searchText, setSearchText, errorMessage, setErrorMessage,
  dataReady, fetchFailed, lastVisibleId, setLastVisibleId,
} from '../store'
import type { FilterTab, SortMode } from '../utils'
import { Toolbar } from '../components/Toolbar'
import { Waterfall } from '../components/Waterfall'

const TABS: FilterTab[] = ['all', 'unlocked', 'locked', 'wishlist']
const SORTS: SortMode[] = ['timeDesc', 'timeAsc', 'priceAsc', 'priceDesc']

export function Home() {
  const loc = useLocation()
  const navigate = useNavigate()
  const [, setSP] = useSearchParams()

  // Apply URL params → store on route mount (URL is source of truth)
  const q = loc.query
  const urlTab = q.tab as string | undefined
  const urlSort = q.sort as string | undefined
  const urlColors = (q.colors as string | undefined)?.split(',').filter(Boolean) ?? []
  const urlRaces = (q.races as string | undefined)?.split(',').filter(Boolean) ?? []
  const urlQ = q.q as string | undefined
  const urlLast = q.lastVisible as string | undefined

  if (urlTab && (TABS as string[]).includes(urlTab)) setTab(urlTab as FilterTab)
  if (urlSort && (SORTS as string[]).includes(urlSort)) setSortMode(urlSort as SortMode)
  if (urlColors.length) setSelectedColors(new Set(urlColors))
  if (urlRaces.length) setSelectedRaces(new Set(urlRaces))
  if (urlQ != null) setSearchText(urlQ)
  if (urlLast) setLastVisibleId(Number(urlLast))

  // Store → URL (replace, no history spam). Depends on pathname too so the query
  // survives route switches: opening detail writes it onto the detail URL, closing
  // restores it onto `/`.
  createEffect(() => {
    const p: Record<string, string> = {}
    p.tab = tab()
    p.sort = sortMode()
    p.colors = selectedColors().size > 0 ? [...selectedColors()].join(',') : ''
    p.races = selectedRaces().size > 0 ? [...selectedRaces()].join(',') : ''
    p.q = searchText()
    p.lastVisible = lastVisibleId() != null ? String(lastVisibleId()) : ''
    void loc.pathname // re-run on route change so the query is preserved on both URLs
    setSP(p, { replace: true })
  })

  // open detail: carry the current query onto the detail URL for shareability
  const onOpen = (id: number) => {
    const qs = new URLSearchParams(loc.query as Record<string, string>).toString()
    navigate(`/detail/${id}${qs ? '?' + qs : ''}`)
  }

  // no cache → full-screen loader until first data arrives (cache → immediate render)
  return (
    <Show when={dataReady() || fetchFailed()} fallback={<Loader />}>
      <div class="fixed inset-0 flex flex-col bg-[#f5f5f7]">
        <Toolbar />
        <div class="flex-1 min-h-0 relative">
          <Show when={errorMessage()}>
            <div class="absolute top-3 left-1/2 -translate-x-1/2 z-20 glass rounded-lg px-3 py-1.5 text-sm text-red-700 shadow flex items-center gap-2">
              {errorMessage()}
              <button class="text-xs text-gray-500" onClick={() => setErrorMessage(null)}>关闭</button>
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
    <div class="fixed inset-0 flex items-center justify-center bg-[#f5f5f7]">
      <div class="flex flex-col items-center gap-3 text-gray-500">
        <div class="w-10 h-10 rounded-full border-4 border-gray-300 border-t-blue-600 animate-spin" />
        <span class="text-sm">加载中…</span>
      </div>
    </div>
  )
}
