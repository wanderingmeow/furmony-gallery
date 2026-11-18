import { BAR_BANNER, BAR_ROW, BAR_TABS, TABS_ROW } from '../ui/boxes'
import { SK_BOX } from '../ui/skeletonView'

/** `.sk-bar` is the gray fill, SK_BOX the hook that the dev overlay outlines. */
const CHIP = `sk-bar ${SK_BOX}`

/**
 * The toolbar before the data arrives. The chip sizes are the real ones, measured at a 390px
 * window: search 219x32, tabs 99 / 106 / 106 / 75 by 32.
 */
export function ToolbarSkeleton() {
  return (
    <div class={`${BAR_BANNER} ${SK_BOX} sk-pulse pointer-events-none`}>
      <div class={BAR_ROW}>
        {/* `.search-field` brings its own fill, so no `.sk-bar` here: that rule sets `flex: none`,
            which would stop the field from growing with the row. */}
        <div class={`search-field ${SK_BOX} h-8 flex-1 rounded-lg`} />
      </div>
      <div class={BAR_TABS}>
        {/* No fade on the clipped tabs: a fade would tell the reader that the row scrolls. */}
        <div class={`${TABS_ROW} overflow-hidden pr-2`}>
          <div class={`${CHIP} h-8 w-[99px] shrink-0 rounded-lg`} />
          <div class={`${CHIP} h-8 w-[106px] shrink-0 rounded-lg`} />
          <div class={`${CHIP} h-8 w-[106px] shrink-0 rounded-lg`} />
          <div class={`${CHIP} h-8 w-[75px] shrink-0 rounded-lg`} />
        </div>
      </div>
    </div>
  )
}
