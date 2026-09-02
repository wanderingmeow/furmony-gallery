import { createSignal, onCleanup, onMount } from 'solid-js'
import { FILTER_TABS, TAB_LABELS, type FilterTab } from '../filter'
import {
  tab, setTab, countAll, countUnlocked, countLocked, wishlistUnlockedCount, wishlistLockedCount,
} from '../store'

const COUNT_FOR: Record<FilterTab, () => number> = {
  all: countAll,
  unlocked: countUnlocked,
  locked: countLocked,
  wishlist: wishlistUnlockedCount,
}

export function FilterTabs() {
  // gradient fades only where content actually overflows / is scrolled:
  //  - right fade when there's more content to the right (scrollLeft not at end)
  //  - left fade once the bar is scrolled left (more content to the left)
  let scroller!: HTMLDivElement
  const [overflow, setOverflow] = createSignal(false)
  const [leftEdge, setLeftEdge] = createSignal(false)   // scrollLeft > 1
  const [rightEdge, setRightEdge] = createSignal(false) // more content to the right

  const update = () => {
    const el = scroller
    const over = el.scrollWidth > el.clientWidth + 1
    setOverflow(over)
    setLeftEdge(el.scrollLeft > 1)
    setRightEdge(over && el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
  }

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

  const mask = () => {
    if (!overflow()) return undefined
    const l = leftEdge(), r = rightEdge()
    if (l && r) return 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)'
    if (l) return 'linear-gradient(to right, transparent 0%, black 10%)'
    if (r) return 'linear-gradient(to right, black 90%, transparent 100%)'
    return undefined // fully visible (at right end) — no fade
  }

  return (
    <div
      ref={scroller}
      // pr-2 keeps a gap between the last tab (心愿单) and the picker button even
      // when the bar is scrolled to its far right (otherwise they'd touch)
      class="flex items-center gap-1.5 overflow-x-auto pr-2"
      style={{ '-webkit-mask-image': mask(), 'mask-image': mask() }}
    >
      {FILTER_TABS.map((t) => {
        const selected = () => tab() === t
        const count = () => COUNT_FOR[t]()
        const warn = () => t === 'wishlist' && wishlistLockedCount() > 0
        return (
          <button
            class="h-8 px-3 rounded-lg text-sm whitespace-nowrap"
            classList={{
              'bg-blue-600 text-white': selected(),
              'bg-surface-2 text-ink': !selected() && !warn(),
              'bg-red-600 text-white': !selected() && warn(),
            }}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
            <span class={selected() ? 'text-white/70' : 'text-muted'}> ({count()})</span>
          </button>
        )
      })}
    </div>
  )
}
