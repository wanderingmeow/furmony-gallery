// The funnel's panel hangs below the circle, because the circle stands at the top edge.
import { BarChartOutlined, ClockCircleOutlined, DollarOutlined, FilterFilled, FilterOutlined } from '@ant-design/icons-svg'
import type { IconDefinition } from '@ant-design/icons-svg/lib/types'
import { useNavigate } from '@solidjs/router'
import { statsPath } from '../../router'
import { filtersOnCount } from '../../stores/derivedStore'
import { semanticActive } from '../../stores/semanticStore'
import { sortMode } from '../../stores/filterStore'
import { AntIcon } from '../ui/AntIcon'
import { SortMark } from '../ui/SortMark'
import { FabCircle } from './FabCircle'
import { FabMenu } from './FabMenu'
import { FilterPanel } from './FilterPanel'
import { relevanceLabel, SORT_UP, sortModeLabel, type SortMode } from '../../model/filter'
import { tr } from '../../i18n'
import { statsTitle } from '../../model/titles'

const SORT_GLYPH: Record<SortMode, IconDefinition> = {
  priceAsc: DollarOutlined, priceDesc: DollarOutlined,
  timeAsc: ClockCircleOutlined, timeDesc: ClockCircleOutlined,
}

export function CornerActions() {
  const navigate = useNavigate()
  // a search answer is ranked by the service, so while one is on screen the face is the funnel
  const orderFace = () => semanticActive()
    ? null
    : <SortMark what={SORT_GLYPH[sortMode()]} up={SORT_UP[sortMode()]} />
  const orderLabel = () => tr('sort.title', semanticActive() ? relevanceLabel() : sortModeLabel(sortMode()))

  return (
    <>
      <FabMenu
        drop
        label={orderLabel()}
        icon={() => (filtersOnCount() > 0 ? FilterFilled : FilterOutlined)}
        face={orderFace}
        badge={filtersOnCount}
        panelClass="w-72"
      >
        <FilterPanel />
      </FabMenu>
      {/* The charts are the way out of the list, and an open box is the user working inside it, so
          this circle gives its place to the box where the edge is too narrow to hold both: see
          `[data-chrome='stats']` in index.css. The funnel stays whichever way the edge goes, because
          a search and a filter are one question. */}
      <div data-chrome="stats">
        <FabCircle onClick={() => navigate(statsPath(), { scroll: false })} title={statsTitle()}>
          <AntIcon icon={BarChartOutlined} size={22} />
        </FabCircle>
      </div>
    </>
  )
}
