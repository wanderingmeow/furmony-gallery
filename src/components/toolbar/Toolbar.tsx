import { Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { noSocialOnly, picture, semanticOn, setNoSocialOnly } from '../../store'
import { SearchBar } from './SearchBar'
import { FilterTabs } from './FilterTabs'
import { PictureMode, PictureToggle } from './PictureSearch'
import { BAR_BANNER, BAR_ROW, BAR_TABS } from '../ui/boxes'

export function Toolbar() {
  // The banner carries the group class that the picture row grows from, so a pointer anywhere
  // on the bar counts.
  return (
    <div class={`${BAR_BANNER} group pointer-events-auto`}>
      <div class={BAR_ROW}>
        {/* A picture is the question while it is up, so it takes the field's place. The way out is
            the same circle that opened it, and that circle stays lit while the mode is on. */}
        <Show
          when={picture.on()}
          fallback={<div class="flex-1 min-w-0"><SearchBar /></div>}
        >
          <div class="flex-1 min-w-0"><PictureMode /></div>
        </Show>
        <Show when={semanticOn()}><PictureToggle /></Show>
        <Show when={noSocialOnly() && !picture.on()}>
          <NoSocialBadge />
        </Show>
      </div>
      {/* Color and species filters sit in the bottom-right FAB column: the thumb reaches
          them there, and their panel has to float over the list anyway.
          A picture answer covers every tab, so the counts would be the text search's own. */}
      <Show when={!picture.on()}>
        <div class={BAR_TABS}><FilterTabs /></div>
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
      class="shrink-0 flex items-center gap-1 h-8 px-2 rounded-lg bg-accent/15 text-accent-soft
             text-sm font-semibold hover:text-accent-deep"
      onClick={() => {
        setNoSocialOnly(false)
        navigate('/', { scroll: false, replace: true })
      }}
      title="关闭无社媒筛选"
      aria-label="关闭无社媒筛选"
    >无社媒 ✕</button>
  )
}
