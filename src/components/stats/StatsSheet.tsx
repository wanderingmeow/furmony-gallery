import { lazy, Suspense, type JSX } from 'solid-js'
import { Sheet } from '../sheet/Sheet'
import { SheetTitleSkeleton } from '../sheet/SheetSkeleton'
import { type LockFilter } from '../../model/statistics'
import { STATS_TITLE } from '../../model/titles'

// The statistics sheet: the shared Sheet chrome around charts that arrive in a lazy chunk.
// The header comes from that same chunk, so the sheet opens on the same placeholder the
// detail screen uses, and the title, the ✕ and the lock switch arrive with the charts.
const StatsHeaderLazy = lazy(() => import('../../routes/Stats').then((m) => ({ default: m.StatsHeader })))

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
      // The header stays above the scroller, so the charts cannot scroll under it.
      header={(dismiss) => (
        <Suspense fallback={<SheetTitleSkeleton title={STATS_TITLE} />}>
          <StatsHeaderLazy mode={props.mode} setMode={props.setMode} onClose={dismiss} />
        </Suspense>
      )}
    >
      {(dismiss) => <div class="min-h-full px-4 pb-6">{props.children(dismiss)}</div>}
    </Sheet>
  )
}
