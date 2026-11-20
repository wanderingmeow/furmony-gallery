import { tr } from '../../i18n'
import { createSignal, For, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { detailPath } from '../../router'
import { getNotifications, removeNotification } from '../../stores/notificationStore'
import { onImageError, sizedUrl, stableImageUrl } from '../../data/image'
import { formatPrice } from '../../model/domain'
import type { ListingChange } from '../../stores/notificationStore'

// The caller places this. App puts it in the top-right corner.
// - collapsed: compact widget with a count badge; click to expand
// - expanded: all notifications stacked; click a row to open detail + dismiss, or 忽略
// - no auto-dismiss; persists until manually removed
// Rows stay plain text. ↑/↓ shows the direction, and colored badges belong on the cards.
export function NotificationCenter() {
  const navigate = useNavigate()
  const [expanded, setExpanded] = createSignal(false)
  const n = () => getNotifications()

  const open = (c: ListingChange) => {
    navigate(detailPath(c.id), { scroll: false })
    removeNotification(c.uid)
  }

  const text = (c: ListingChange) =>
    c.kind === 'lock'
      ? tr(c.isLocked ? 'notify.locked' : 'notify.unlocked')
      : `${tr(c.to > c.from ? 'notify.priceUp' : 'notify.priceDown')} ${formatPrice(c.from)} → ${formatPrice(c.to)}`

  return (
    <Show when={n().length > 0}>
      <div class="flex flex-col items-end gap-1">
        <Show
          when={expanded()}
          fallback={
            <button
              class="bg-accent text-white rounded-xl shadow-lg px-4 py-3 flex items-center gap-2.5"
              onClick={() => setExpanded(true)}
              aria-label={tr('notify.expand', n().length)}
            >
              <span class="text-base font-medium">{tr('notify.title')}</span>
              <span class="relative inline-flex items-center justify-center min-w-6.5 h-6.5 px-1.5 rounded-full bg-white text-accent-ink text-sm font-bold">
                {n().length}
              </span>
            </button>
          }
        >
          {/* The header sits outside the scroller, the way the sheet keeps its bottom bar out. */}
          <div class="glass rounded-xl shadow-lg border border-border w-72 max-h-[70vh] flex flex-col clip-no-scroll">
            <div class="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
              <span class="text-sm font-semibold text-ink">{tr('notify.title')} ({n().length})</span>
              <button class="text-sm text-muted hover:text-ink" onClick={() => setExpanded(false)}>{tr('notify.collapse')}</button>
            </div>
            <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <For each={n()}>
                {(c) => (
                  <div class="flex items-center gap-2 px-3 py-2 border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5">
                    <Show when={c.headPicture} fallback={<span class="w-9 h-9 rounded-full bg-surface-2 shrink-0" />}>
                      {(url) => <img src={sizedUrl(stableImageUrl(url()), 'badge')} alt="" class="w-9 h-9 rounded-full object-cover shrink-0" onError={onImageError} />}
                    </Show>
                    <button class="min-w-0 flex-1 text-left" onClick={() => open(c)}>
                      <span class="text-sm font-medium">{c.name} #{c.id} {text(c)}</span>
                    </button>
                    <button
                      class="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-faint hover:text-ink hover:bg-black/10 dark:hover:bg-white/10"
                      onClick={() => removeNotification(c.uid)}
                      aria-label={tr('notify.dismiss')}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  )
}
