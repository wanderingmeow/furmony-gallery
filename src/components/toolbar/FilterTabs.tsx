import { createSignal, For, onCleanup, onMount } from 'solid-js'
import { FILTER_TABS, tabLabel, type FilterTab } from '../../model/filter'
import { edgeFade, fadeMask, NO_FADE, type EdgeFade } from '../../draw/fade'
import { tab, setTab } from '../../stores/filterStore'
import { countAll, countUnlocked, countLocked, wishlistCount } from '../../stores/derivedStore'
import { TABS_ROW } from '../ui/boxes'

// The fade is 40px wide at most and empties over 80px of scrolling. The tab row slides freely, so the
// range only has to cover the fade. The card row snaps, so its range has to be wider than one step.
const FADE_PX = 40
const FADE_RANGE = 80

const COUNT_FOR: Record<FilterTab, () => number> = {
  all: countAll,
  unlocked: countUnlocked,
  locked: countLocked,
  wishlist: wishlistCount,
}

export function FilterTabs() {
  // The fade follows how much is left to scroll instead of switching on "any overflow at
  // all", so it retires by itself near the end instead of leaving what looks like a
  // shadow on the last tab.
  let scroller!: HTMLDivElement
  const [fade, setFade] = createSignal<EdgeFade>(NO_FADE)

  // The row sits on .glass, so the fade is a mask: painting canvas color over it would cover
  // the blur behind.
  const update = () => setFade(edgeFade(scroller, FADE_RANGE))

  onMount(() => {
    update()
    scroller.addEventListener('scroll', update)
    // The counts arrive after the first paint, and a tab gets wider once its number appears. The
    // row's own box keeps its size through that, so watching only the row would leave the fade on
    // the right edge at the old width. That is why each button is observed too.
    const ro = new ResizeObserver(update)
    ro.observe(scroller)
    for (const child of Array.from(scroller.children)) ro.observe(child)
    onCleanup(() => {
      scroller.removeEventListener('scroll', update)
      ro.disconnect()
    })
  })

  const mask = () => fadeMask(fade(), FADE_PX) ?? undefined

  return (
    <div
      ref={scroller}
      // pr-2 stops the last tab (收藏) from sitting flush against the card edge when the
      // bar is scrolled to its far right
      class={`${TABS_ROW} overflow-x-auto pr-2`}
      style={{ '-webkit-mask-image': mask(), 'mask-image': mask() }}
    >
      <For each={FILTER_TABS}>
        {(name) => {
          const selected = () => tab() === name
          const count = COUNT_FOR[name]
          return (
            <button
              class="h-8 px-3 rounded-lg text-sm whitespace-nowrap"
              classList={{
                'bg-accent text-white': selected(),
                'bg-surface-2 text-ink': !selected(),
              }}
              onClick={() => setTab(name)}
            >
              {tabLabel(name)}
              <span class={selected() ? 'text-white/70' : 'text-muted'}> ({count()})</span>
            </button>
          )
        }}
      </For>
    </div>
  )
}
