import { ArrowDownOutlined, ArrowUpOutlined, ClockCircleOutlined, DollarOutlined } from '@ant-design/icons-svg'
import type { SortMode } from '../filter'
import { sortMode, setSortMode } from '../store'
import { AntIcon } from './AntIcon'

// simplest toggle: each button only flips between its own two directions and never
// cancels back to the other group (no triple-press-to-deselect)
function togglePrice(current: SortMode): SortMode {
  // enter price group at priceAsc, then flip asc↔desc — never cancels back to time
  return current === 'priceAsc' ? 'priceDesc' : 'priceAsc'
}

function toggleTime(current: SortMode): SortMode {
  // enter time group at timeDesc (default), then flip desc↔asc — never cancels back
  return current === 'timeDesc' ? 'timeAsc' : 'timeDesc'
}

export function SortButtons() {
  const sm = () => sortMode()
  const isPrice = () => sm() === 'priceAsc' || sm() === 'priceDesc'
  const isTime = () => sm() === 'timeDesc' || sm() === 'timeAsc'
  // Swift parity: explicit up/down arrows for direction (small→large / large→small)
  const priceIcon = () => isPrice() ? (sm() === 'priceAsc' ? ArrowUpOutlined : ArrowDownOutlined) : DollarOutlined
  const timeIcon = () => isTime() ? (sm() === 'timeDesc' ? ArrowDownOutlined : ArrowUpOutlined) : ClockCircleOutlined

  return (
    <div class="flex items-center gap-2">
      <button
        class="h-8 px-2 rounded-lg text-sm flex items-center gap-1"
        classList={{ 'bg-orange-400/25 text-orange-700 dark:text-orange-300': isPrice(), 'bg-surface-2 text-ink': !isPrice() }}
        onClick={() => setSortMode(togglePrice(sm()))}
      >
        <AntIcon icon={priceIcon} /> 价格
      </button>
      <button
        class="h-8 px-2 rounded-lg text-sm flex items-center gap-1"
        classList={{ 'bg-orange-400/25 text-orange-700 dark:text-orange-300': isTime(), 'bg-surface-2 text-ink': !isTime() }}
        onClick={() => setSortMode(toggleTime(sm()))}
      >
        <AntIcon icon={timeIcon} /> 时间
      </button>
    </div>
  )
}
