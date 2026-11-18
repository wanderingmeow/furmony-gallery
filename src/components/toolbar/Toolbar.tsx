import { Show } from 'solid-js'
import { picture, semanticOn } from '../../stores/semanticStore'
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
