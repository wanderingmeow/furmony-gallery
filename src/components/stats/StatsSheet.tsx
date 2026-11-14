import { For, type JSX } from 'solid-js'
import { AntIcon } from '../ui/AntIcon'
import { CloseOutlined } from '@ant-design/icons-svg'
import { LOCK_FILTERS, LOCK_LABELS, type LockFilter } from '../../model/statistics'
import { Sheet } from '../sheet/Sheet'
import { SheetFab } from '../ui/SheetFab'
import { SEG_ITEM, SEG_ITEM_STATE, SEG_ROW } from '../ui/segment'

// The stats screen: the shared Sheet chrome, plus a header (close button, title, lock
// filter) over the scrollable charts. The Sheet handles the slide, the drag that closes it,
// the backdrop and the scroll lock; this component builds the header and the charts.
export function StatsSheet(props: {
  open: () => boolean
  onDismiss: () => void
  mode: () => LockFilter
  setMode: (m: LockFilter) => void
  children: (dismiss: () => void) => JSX.Element
}) {
  return (
    <Sheet
      open={props.open}
      onDismiss={props.onDismiss}
      // The header sits above the scroller, so the charts cannot scroll under it.
      header={(dismiss) => (
        <div class="flex items-center gap-4 p-4 bg-canvas">
          <SheetFab label="关闭" onClick={dismiss}>
            <AntIcon icon={CloseOutlined} size={22} />
          </SheetFab>
          <h1 class="text-lg font-semibold text-ink">数据统计</h1>
          <div class={`ml-auto inline-flex items-center justify-center ${SEG_ROW}`}>
            <For each={LOCK_FILTERS}>
              {(f) => (
                <button
                  class={SEG_ITEM}
                  classList={SEG_ITEM_STATE(props.mode() === f)}
                  onClick={() => props.setMode(f)}
                >
                  {LOCK_LABELS[f]}
                </button>
              )}
            </For>
          </div>
        </div>
      )}
    >
      {/* scrollable stats content */}
      {(dismiss) => (
        <div class="min-h-full px-4 pb-6">
          {props.children(dismiss)}
        </div>
      )}
    </Sheet>
  )
}
