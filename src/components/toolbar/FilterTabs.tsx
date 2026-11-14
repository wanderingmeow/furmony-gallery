import { createSignal, For, onCleanup, onMount } from 'solid-js'
import { FILTER_TABS, TAB_LABELS, type FilterTab } from '../../model/filter'
import { edgeFade, fadeMask, NO_FADE, type EdgeFade } from '../../draw/fade'
import {
  tab, setTab, countAll, countUnlocked, countLocked, wishlistCount,
  noSocialOnly, remainingLocked,
} from '../../store'

// 渐隐最宽 40px，在 80px 的滑动距离内退到 0。tab 排是自由滑动（不吸附），所以不用像
// 卡片那一排把 range 拉到比一档 snap 宽
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

  // A mask, not an overlay: this row sits on .glass, and painting canvas colour over it
  // would cover the blur behind.
  const update = () => setFade(edgeFade(scroller, FADE_RANGE))

  onMount(() => {
    update()
    scroller.addEventListener('scroll', update)
    const ro = new ResizeObserver(update)
    ro.observe(scroller)
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
      class="flex items-center gap-1.5 overflow-x-auto pr-2"
      style={{ '-webkit-mask-image': mask(), 'mask-image': mask() }}
    >
      <For each={FILTER_TABS}>
        {(t) => {
          const selected = () => tab() === t
          // While the no-social debug filter is active, the locked tab shows annotation
          // progress as 剩余/总数 (remaining no-social locked / total locked). Unfiltered.
          const count = () => (t === 'locked' && noSocialOnly()
            ? `${remainingLocked()}/${countLocked()}`
            : COUNT_FOR[t]())
          return (
            <button
              class="h-8 px-3 rounded-lg text-sm whitespace-nowrap"
              classList={{
                'bg-orange-500 text-white': selected(),
                'bg-surface-2 text-ink': !selected(),
              }}
              onClick={() => setTab(t)}
            >
              {TAB_LABELS[t]}
              <span class={selected() ? 'text-white/70' : 'text-muted'}> ({count()})</span>
            </button>
          )
        }}
      </For>
    </div>
  )
}
