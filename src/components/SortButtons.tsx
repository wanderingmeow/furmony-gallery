import { ArrowDownOutlined, ArrowUpOutlined, ClockCircleOutlined, DollarOutlined } from '@ant-design/icons-svg'
import type { SortMode } from '../utils'
import { sortMode, setSortMode } from '../store'
import { AntIcon } from './AntIcon'

function togglePrice(current: SortMode): SortMode {
  switch (current) {
    case 'timeDesc': case 'timeAsc': return 'priceAsc'
    case 'priceAsc': return 'priceDesc'
    case 'priceDesc': return 'timeDesc'
  }
}

function toggleTime(current: SortMode): SortMode {
  switch (current) {
    case 'priceAsc': case 'priceDesc': return 'timeDesc'
    case 'timeDesc': return 'timeAsc'
    case 'timeAsc': return 'timeDesc'
  }
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
        classList={{ 'bg-orange-400/25 text-orange-700': isPrice(), 'bg-gray-200/70 text-gray-600': !isPrice() }}
        onClick={() => setSortMode(togglePrice(sm()))}
      >
        <AntIcon icon={priceIcon} /> 价格
      </button>
      <button
        class="h-8 px-2 rounded-lg text-sm flex items-center gap-1"
        classList={{ 'bg-orange-400/25 text-orange-700': isTime(), 'bg-gray-200/70 text-gray-600': !isTime() }}
        onClick={() => setSortMode(toggleTime(sm()))}
      >
        <AntIcon icon={timeIcon} /> 时间
      </button>
    </div>
  )
}
