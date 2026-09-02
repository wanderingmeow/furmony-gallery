import { SearchBar } from './SearchBar'
import { SortButtons } from './SortButtons'
import { FilterTabs } from './FilterTabs'
import { ColorRacePicker } from './ColorRacePicker'

export function Toolbar() {
  return (
    <div class="glass relative z-40 px-3 py-3 rounded-2xl border border-black/10 shadow-sm mx-4 mt-3 pointer-events-auto">
      <div class="flex items-center gap-2">
        <div class="flex-1 min-w-0"><SearchBar /></div>
        <div class="shrink-0"><SortButtons /></div>
      </div>
      <div class="flex items-center justify-between mt-2">
        <FilterTabs />
        <ColorRacePicker />
      </div>
    </div>
  )
}
