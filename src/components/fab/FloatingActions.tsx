import { createMemo, Show } from 'solid-js'
import {
  BarChartOutlined, FilterFilled, FilterOutlined, SyncOutlined, VerticalAlignTopOutlined,
} from '@ant-design/icons-svg'
import { useNavigate } from '@solidjs/router'
import { fetchFailed, loadData, priceMode, selectedColors, selectedRaces } from '../../store'
import { AntIcon } from '../ui/AntIcon'
import { FabCircle } from './FabCircle'
import { FabMenu } from './FabMenu'
import { STATS_TITLE } from '../../model/titles'
import { FilterPanel } from './FilterPanel'

/**
 * The bottom-right column: back-to-top (a refresh button while the load failed), the
 * settings panel, and the stats entry.
 */
export function FloatingActions(props: { scrollTop: () => number; onTop: () => void }) {
  const isRefresh = fetchFailed
  const navigate = useNavigate()
  const show = () => props.scrollTop() > 0 || fetchFailed()
  // The badge has to survive the panel closing: N filters are still on.
  const filterCount = () => selectedColors().size + selectedRaces().size
  // Orange means "you changed something here", so a price-display change lights the button
  // even when nothing is selected.
  const anySetting = () => filterCount() > 0 || priceMode() !== 'once'
  // How far through the page the reader is, drawn as the ring around the back-to-top button
  const progress = createMemo(() => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    return Math.min(1, Math.max(0, props.scrollTop() / max))
  })

  return (
    <div class="fixed bottom-4 right-4 z-10 flex flex-col items-center gap-2">
      <Show when={show()}>
        <FabCircle
          class="float-progress"
          title={isRefresh() ? '刷新' : '回到顶部'}
          style={{ '--float-btn-progress': `${progress()}turn` }}
          onClick={() => {
            if (isRefresh()) loadData()
            else props.onTop()
          }}
        >
          <AntIcon icon={() => (isRefresh() ? SyncOutlined : VerticalAlignTopOutlined)} size={"1.25em"} />
        </FabCircle>
      </Show>
      {/* One button for the whole settings panel: price display, colours and species. It
          opens upward, which FabMenu handles */}
      <FabMenu
        label="筛选"
        icon={() => (filterCount() > 0 ? FilterFilled : FilterOutlined)}
        active={anySetting}
        badge={filterCount}
        panelClass="w-72"
      >
        <FilterPanel />
      </FabMenu>
      <FabCircle accent glow onClick={() => navigate('/stats', { scroll: false })} title={STATS_TITLE}>
        <AntIcon icon={BarChartOutlined} size={"1.5em"} />
      </FabCircle>
    </div>
  )
}
