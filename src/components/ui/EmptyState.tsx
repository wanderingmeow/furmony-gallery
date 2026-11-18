import { Show } from 'solid-js'
import { FilterOutlined, HeartOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons-svg'
import type { IconDefinition } from '@ant-design/icons-svg/lib/types'
import { applyEmptyAction, emptyState } from '../../stores/derivedStore'
import { EMPTY_ACTION_LABELS, type EmptyIcon } from '../../model/emptyState'
import { AntIcon } from './AntIcon'
import { SPARK } from './spark'

const ICONS: Record<EmptyIcon, IconDefinition> = {
  heart: HeartOutlined,
  search: SearchOutlined,
  filter: FilterOutlined,
  spark: SPARK,
  warning: WarningOutlined,
}

/**
 * What the list says when it has nothing to show: the reason, and the one thing that fixes it.
 *
 * The box fills the space between the floating toolbar and the controls at the bottom, so the
 * words sit where the reader is looking. The box stays on the page even with no reason to show,
 * which keeps the copyright band from jumping up to the toolbar.
 */
export function EmptyState() {
  const run = () => {
    const s = emptyState()
    if (!s?.action) return
    applyEmptyAction(s.action)
  }

  return (
    // 16rem is what the page's own parts take up: the toolbar's 8rem above this box and the
    // copyright band's 8rem below it. The box fills the rest, so the band sits at the bottom of
    // the screen in full view.
    <div class="flex min-h-[calc(100vh-16rem)] flex-col items-center justify-center gap-1.5 px-8 py-10 text-center">
      <Show when={emptyState()}>
        {(s) => (
          <>
            <AntIcon icon={ICONS[s().icon]} size="34px" class="text-faint" />
            <div class="mt-1 text-base font-medium text-ink">{s().title}</div>
            <Show when={s().line}>
              {(line) => <div class="text-sm text-muted">{line()}</div>}
            </Show>
            <Show when={s().action}>
              {(action) => (
                <button
                  class="mt-2 rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-ink hover:bg-surface-2"
                  onClick={run}
                >
                  {EMPTY_ACTION_LABELS[action()]}
                </button>
              )}
            </Show>
          </>
        )}
      </Show>
    </div>
  )
}
