import { Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { noSocialOnly, setNoSocialOnly } from '../store'
import { SearchBar } from './SearchBar'
import { SortButtons } from './SortButtons'
import { FilterTabs } from './FilterTabs'
import { ColorRacePicker } from './ColorRacePicker'

export function Toolbar() {
  return (
    <div class="glass relative z-40 px-3 py-3 rounded-2xl border border-black/10 shadow-sm mx-4 mt-3 pointer-events-auto">
      <div class="flex items-center gap-2">
        <div class="flex-1 min-w-0"><SearchBar /></div>
        <div class="shrink-0"><SortButtons /></div>
        {/* debug/tracking aid — active only while ?nosocial=1 is in the URL */}
        <Show when={noSocialOnly()}>
          <NoSocialBadge />
        </Show>
      </div>
      <div class="flex items-center justify-between mt-2">
        <FilterTabs />
        <ColorRacePicker />
      </div>
    </div>
  )
}

// Compact badge shown when the no-social filter (?nosocial=1) is active — click ✕ to
// clear (navigates back to `/` without the query). Kept in the toolbar's top row so it
// doesn't change the toolbar height.
function NoSocialBadge() {
  const navigate = useNavigate()
  return (
    <div class="shrink-0 flex items-center gap-1 h-8 px-2 py-1 rounded-lg bg-orange-500/15 text-orange-700 text-sm font-semibold">
      无社媒
      <button
        class="-ml-0.5 px-0.5 hover:text-orange-900"
        onClick={() => {
          // exit the debug mode (session flag) + drop the URL query so a refresh doesn't re-enable
          setNoSocialOnly(false)
          navigate('/', { scroll: false, replace: true })
        }}
        title="关闭无社媒筛选"
        aria-label="关闭无社媒筛选"
      >✕</button>
    </div>
  )
}
