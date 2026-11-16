import { Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { noSocialOnly, picture, semanticActive, semanticOn, setNoSocialOnly } from '../../store'
import { CollapseX } from '../ui/CollapseX'
import { SearchBar } from './SearchBar'
import { SortButtons } from './SortButtons'
import { FilterTabs } from './FilterTabs'
import { PictureMode, PictureToggle } from './PictureSearch'

export function Toolbar() {
  // The banner carries the group class that the picture row grows from, so a pointer anywhere
  // on the bar counts.
  return (
    <div class="glass group relative z-40 px-3 py-3 rounded-2xl border border-black/10
                shadow-sm dark:shadow-md mx-4 mt-3 pointer-events-auto">
      <div class="flex items-center gap-2">
        <Show when={!picture.on()} fallback={<PictureMode />}>
          <div class="flex-1 min-w-0"><SearchBar /></div>
          <Show when={semanticOn()}><PictureToggle /></Show>
          {/* Hidden rather than disabled: sorting a picture's ranking would undo it. */}
          <CollapseX when={!semanticActive()}><SortButtons /></CollapseX>
          <Show when={noSocialOnly()}>
            <NoSocialBadge />
          </Show>
        </Show>
      </div>
      {/* Colour and species filters sit in the bottom-right FAB column: the thumb reaches
          them there, and their panel has to float over the list anyway. */}
      <Show when={!picture.on()}>
        <div class="mt-2"><FilterTabs /></div>
      </Show>
    </div>
  )
}

/** Clearing takes both the session flag and the URL query: a refresh re-reads the query, so
 *  dropping only one turns the mode straight back on. */
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
