import { createSignal, For, Show } from 'solid-js'
import { getNotifications, removeNotification, openDetail } from '../store'
import { onImageError, stableImageUrl } from '../image'
import type { LockChange } from '../store'

// Collapsed notification center (top-right):
// - collapsed: compact widget with a count badge; click to expand
// - expanded: all notifications stacked; click a row to open detail + dismiss, or 忽略
// - no auto-dismiss; persists until manually removed
export function NotificationCenter() {
  const [expanded, setExpanded] = createSignal(false)
  const n = () => getNotifications()

  const open = (c: LockChange) => {
    openDetail(c.id)
    removeNotification(c.uid)
  }

  return (
    <Show when={n().length > 0}>
      <div class="fixed top-3 right-4 z-50 flex flex-col items-end gap-1">
        <Show
          when={expanded()}
          fallback={
            <button
              class="bg-orange-500 text-white rounded-xl shadow-lg px-4 py-3 flex items-center gap-2.5"
              onClick={() => setExpanded(true)}
              aria-label={`展开 ${n().length} 条通知`}
            >
              <span class="text-base font-medium">锁定状态变更</span>
              <span class="relative inline-flex items-center justify-center min-w-6.5 h-6.5 px-1.5 rounded-full bg-white text-orange-600 text-sm font-bold">
                {n().length}
              </span>
            </button>
          }
        >
          <div class="glass rounded-xl shadow-lg border border-border w-72 max-h-[70vh] overflow-y-auto">
            <div class="flex items-center justify-between px-4 py-2.5 border-b border-border sticky top-0 bg-surface/70 backdrop-blur">
              <span class="text-sm font-semibold text-ink">锁定状态变更 ({n().length})</span>
              <button class="text-sm text-muted hover:text-ink" onClick={() => setExpanded(false)}>收起</button>
            </div>
            <For each={n()}>
              {(c) => (
                <div class="flex items-center gap-2 px-3 py-2 border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5">
                  <Show when={c.headPicture} fallback={<span class="w-9 h-9 rounded-full bg-surface-2 shrink-0" />}>
                    {(url) => <img src={stableImageUrl(url())} alt="" class="w-9 h-9 rounded-full object-cover shrink-0" onError={onImageError} />}
                  </Show>
                  <button class="min-w-0 flex-1 text-left" onClick={() => open(c)}>
                    <span class="text-sm font-medium">{c.name} #{c.id} {c.isLocked ? '已锁定' : '已取消锁定'}</span>
                  </button>
                  <button
                    class="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-faint hover:text-ink hover:bg-black/10 dark:hover:bg-white/10"
                    onClick={() => removeNotification(c.uid)}
                    aria-label="忽略"
                  >
                    ✕
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  )
}
