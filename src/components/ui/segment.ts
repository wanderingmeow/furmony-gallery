// One row of mutually exclusive choices. Two screens use it: the lock filter in the stats
// header and 价格显示 in the filter panel. Only the width differs, so the row and the
// buttons are shared here and each caller adds its own layout.

export const SEG_ROW = 'gap-1 rounded-xl border border-border bg-surface p-1'

export const SEG_ITEM = 'rounded-lg px-3 py-1.5 text-xs font-medium transition-all'

export const SEG_ITEM_STATE = (on: boolean) => ({
  'bg-surface-2 text-ink': on,
  'text-muted hover:text-ink hover:bg-surface-2': !on,
})
