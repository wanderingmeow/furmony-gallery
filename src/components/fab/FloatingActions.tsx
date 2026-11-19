import { createMemo, Show } from 'solid-js'
import {
  BarChartOutlined, ClockCircleOutlined, DollarOutlined, FilterFilled, FilterOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons-svg'
import type { IconDefinition } from '@ant-design/icons-svg/lib/types'
import { useNavigate } from '@solidjs/router'
import { filtersOnCount } from '../../stores/derivedStore'
import { semanticActive } from '../../stores/semanticStore'
import { sortMode } from '../../stores/filterStore'
import { AntIcon } from '../ui/AntIcon'
import { SortMark } from '../ui/SortMark'
import { FabCircle } from './FabCircle'
import { FabMenu } from './FabMenu'
import { RELEVANCE_SAY, SORT_FACE, type SortMode } from '../../model/filter'
import { STATS_TITLE } from '../../model/titles'
import { FilterPanel } from './FilterPanel'

const SORT_GLYPH: Record<SortMode, IconDefinition> = {
  priceAsc: DollarOutlined, priceDesc: DollarOutlined,
  timeAsc: ClockCircleOutlined, timeDesc: ClockCircleOutlined,
}

/**
 * A load that failed is the banner at the top of the page to report, and that banner carries the
 * retry. This column only scrolls up.
 */
export function FloatingActions(props: { scrollTop: () => number; onTop: () => void }) {
  const navigate = useNavigate()
  const show = () => props.scrollTop() > 0
  // The button shows the order the grid is in. A search answer is ranked by the service, so while
  // one is on screen the button goes back to the funnel.
  const orderFace = () => semanticActive()
    ? null
    : <SortMark what={SORT_GLYPH[sortMode()]} up={SORT_FACE[sortMode()].up} />
  const orderLabel = () => `排序：${semanticActive() ? RELEVANCE_SAY : SORT_FACE[sortMode()].say}`
  // progress = how far through the page the reader is, drawn as the ring around the button
  const progress = createMemo(() => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    return Math.min(1, Math.max(0, props.scrollTop() / max))
  })

  return (
    <div class="fixed bottom-4 right-4 z-10 flex flex-col items-center gap-2">
      <Show when={show()}>
        <FabCircle
          class="float-progress"
          title="回到顶部"
          style={{ '--float-btn-progress': `${progress()}turn` }}
          onClick={props.onTop}
        >
          <AntIcon icon={VerticalAlignTopOutlined} size="1.25em" />
        </FabCircle>
      </Show>
      {/* One button for the whole panel: the order, colors, species, the owner-account switch,
          the price display and the search switch. It opens upward, which FabMenu handles. The
          fill is the panel being open; the number is what stays on. */}
      <FabMenu
        label={orderLabel()}
        icon={() => (filtersOnCount() > 0 ? FilterFilled : FilterOutlined)}
        face={orderFace}
        badge={filtersOnCount}
        panelClass="w-72"
      >
        <FilterPanel />
      </FabMenu>
      <FabCircle accent glow onClick={() => navigate('/stats', { scroll: false })} title={STATS_TITLE}>
        <AntIcon icon={BarChartOutlined} size="1.25em" />
      </FabCircle>
    </div>
  )
}
