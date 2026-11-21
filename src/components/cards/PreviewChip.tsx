import { createEffect, createSignal, on, onCleanup, Show } from 'solid-js'
import type { AdoptListing } from '../../model/types'
import { publishDayAt } from '../../model/domain'
import { orderLabel } from '../../model/filter'
import { semanticActive } from '../../stores/semanticStore'
import { sortMode } from '../../stores/filterStore'
import {
  indexOfRow, PREVIEW_FADE_MS, PREVIEW_H, PREVIEW_IDLE_MS, PREVIEW_SCROLLBAR_GAP, VIEW_PAD,
} from '../../draw/layout'
import { previewTop } from '../../draw/scrollbar'
import { pageIsHeld } from '../../draw/pageHold'
import { watchViewport } from '../ui/viewport'

/** The day at the right edge, at the middle of the scrollbar thumb: a tooltip over the cards. */
export function PreviewChip(props: {
  items: () => AdoptListing[]
  scrollTop: () => number
  rowHeight: () => number
  cols: () => number
  topPad: () => number
}) {
  const { viewportH, safe } = watchViewport()
  const preview = createPreviewController()

  // overlay bars (iOS, macOS by default) report no width, so the chip uses VIEW_PAD
  const barGap = () => {
    const bar = window.innerWidth - document.documentElement.clientWidth
    return bar > 0 ? bar + PREVIEW_SCROLLBAR_GAP : VIEW_PAD
  }

  const sync = () => {
    // the browser's number includes the band under the last row, whose height follows its text
    const range = Math.max(0, document.documentElement.scrollHeight - viewportH())
    // the chip is a tooltip, so it travels the whole edge: safe insets only
    const top = previewTop(props.scrollTop(), range, viewportH(),
      { top: safe().top, bottom: viewportH() - safe().bottom }, PREVIEW_H)
    // a page barely one screen long has no thumb, so nothing is drawn
    if (top === null) return
    if (pageIsHeld()) return
    // the row at the top of the window is the one covering (scrollY - topPad)
    const row = Math.floor(Math.max(0, props.scrollTop() - props.topPad()) / props.rowHeight())
    const index = indexOfRow(row, props.cols(), props.items().length)
    preview.sync(orderLabel({
      item: props.items()[index], day: publishDayAt(props.items(), index),
      ranked: semanticActive(), sort: sortMode(),
    }), top, barGap())
  }

  // Deferred: the chip answers to scroll, so a list nobody has scrolled reads nothing.
  createEffect(on(props.scrollTop, sync, { defer: true }))

  // a sort can change while the chip is up, and scroll alone cannot catch that
  createEffect(on(semanticActive, (ranked) => { if (ranked) preview.hide() }))

  return (
    // fixed, because the document scrolls and an absolute chip would go with the cards
    <Show when={preview.preview()}>
      {(p) => (
        <div
          // z-50 sits above the band and the pill (z-40). opacity-0 is the fade-out
          class="fixed z-50 glass rounded-lg px-3 py-2 text-sm font-semibold tabular-nums shadow pointer-events-none transition-opacity duration-300"
          classList={{ 'opacity-0': preview.leaving() }}
          style={{ top: `${p().top}px`, right: `${p().right}px` }}
        >
          {p().label}
        </div>
      )}
    </Show>
  )
}

// The fade starts PREVIEW_IDLE_MS after the last frame, and the element unmounts when the fade
// ends. A new scroll cancels a pending fade rather than restarting it, which would read as a blink.
function createPreviewController() {
  const [preview, setPreview] = createSignal<{ label: string; top: number; right: number } | null>(null)
  const [leaving, setLeaving] = createSignal(false)
  let hideTimer: number | null = null
  let fadeTimer: number | null = null

  const update = (label: string, top: number, right: number) => {
    setPreview({ label, top, right })
    setLeaving(false)
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null }
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      hideTimer = null
      setLeaving(true)
      fadeTimer = setTimeout(() => {
        fadeTimer = null
        setPreview(null)
        setLeaving(false)
      }, PREVIEW_FADE_MS)
    }, PREVIEW_IDLE_MS)
  }
  /** Hide the chip now. The fade is skipped, and both timers are cleared. */
  const hide = () => {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null }
    setLeaving(false)
    setPreview(null)
  }
  /** Draw the chip. An empty label means this order has nothing to read out, so the chip hides. */
  const sync = (label: string, top: number, right: number) => {
    if (label === '') hide()
    else update(label, top, right)
  }
  onCleanup(() => hide())
  return { preview, leaving, sync, hide }
}
