import { Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { noSocialOnly, setNoSocialOnly } from '../../store'
import { SearchBar } from './SearchBar'
import { SortButtons } from './SortButtons'
import { FilterTabs } from './FilterTabs'

export function Toolbar() {
  return (
    <div class="glass relative z-40 px-3 py-3 rounded-2xl border border-black/10 shadow-sm mx-4 mt-3 pointer-events-auto">
      <div class="flex items-center gap-2">
        <div class="flex-1 min-w-0"><SearchBar /></div>
        <div class="shrink-0"><SortButtons /></div>
        <Show when={noSocialOnly()}>
          <NoSocialBadge />
        </Show>
      </div>
      {/* Colour and species filters sit in the bottom-right FAB column: the thumb reaches
          them there, and their panel has to float over the list anyway. */}
      <div class="mt-2"><FilterTabs /></div>
    </div>
  )
}

/**
 * The whole pill is the exit, so the tap target is the pill rather than a 15px ✕.
 * Clearing means both the session flag and the URL query — a refresh re-reads the query,
 * so dropping only one of them would switch the mode straight back on.
 */
function NoSocialBadge() {
  const navigate = useNavigate()
  return (
    <button
      class="shrink-0 flex items-center gap-1 h-8 px-2 rounded-lg bg-orange-500/15 text-orange-700
             text-sm font-semibold hover:text-orange-900"
      onClick={() => {
        setNoSocialOnly(false)
        navigate('/', { scroll: false, replace: true })
      }}
      title="关闭无社媒筛选"
      aria-label="关闭无社媒筛选"
    >无社媒 ✕</button>
  )
}
