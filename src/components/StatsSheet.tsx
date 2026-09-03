import { For, type JSX } from 'solid-js'
import { AntIcon } from './AntIcon'
import { CloseOutlined } from '@ant-design/icons-svg'
import { LOCK_FILTERS, LOCK_LABELS, type LockFilter } from '../statistics'
import { Sheet } from './Sheet'

// Stats sheet = shared Sheet chrome + a fixed header (close button, title, lock
// filter) over the scrollable stats content. The Sheet owns slide-in/out, the
// drag-to-dismiss gesture, the blurred backdrop and background-scroll limiting;
// this component owns the header + the (lazy) stats content.
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
      // fixed header — close button (left), title, lock filter (top-right); sits
      // ABOVE the scroller, so the charts scrolling behind never cover it
      header={(dismiss) => (
        <div class="flex items-center gap-4 p-4 bg-canvas">
          <button
            class="w-11 h-11 rounded-full glass flex items-center justify-center border border-border"
            onClick={dismiss}
            aria-label="关闭"
            title="关闭"
          >
            <AntIcon icon={CloseOutlined} size={22} />
          </button>
          <h1 class="text-lg font-semibold text-ink">数据统计</h1>
          <div class="ml-auto inline-flex items-center justify-center gap-1 rounded-xl border border-border bg-surface p-1">
            <For each={LOCK_FILTERS}>
              {(f) => (
                <button
                  class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  classList={{
                    'bg-surface-2 text-ink': props.mode() === f,
                    'text-muted hover:text-ink hover:bg-surface-2': props.mode() !== f,
                  }}
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
