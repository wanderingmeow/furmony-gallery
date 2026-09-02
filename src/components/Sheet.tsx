import { createEffect, createSignal, onCleanup, Show, type JSX } from 'solid-js'
import { scrollLock } from '../scrollLock'

// Limit background scroll: while a sheet is open the document is pinned, so
// wheel/touch over the backdrop can't scroll the list behind it. Ref-counted in
// the scrollLock module so stacked sheets stay correct (only one is open at a time).

// Shared iOS-style sheet chrome, used by both DetailSheet and StatsSheet:
//  - slide-in/out (position-driven `pos` signal so the animation is interruptible)
//  - mobile drag-down-to-dismiss (engages only when the content scroller is at
//    its top, so dragging down scrolls the content natively otherwise)
//  - dimmed + blurred backdrop
//  - background scroll is LIMITED: while open the document is scroll-locked, so
//    wheel/touch over the backdrop can't scroll the list behind the sheet
//  - Esc closes
//
// `children` is a render prop that receives `dismiss` (the slide-out + navigate
// action) so the content can wire its own close button (Detail / stats header).
export function Sheet(props: {
  open: () => boolean
  onDismiss: () => void
  children: (dismiss: () => void) => JSX.Element
}) {
  const [closing, setClosing] = createSignal(false)
  const [pos, setPos] = createSignal(1)
  const [dragging, setDragging] = createSignal(false)
  let sheetEl: HTMLDivElement | null = null
  let startY = 0
  let startScrollTop = 0
  const SAMPLES: { t: number; y: number }[] = []

  // Limit background scroll: while open, pin the document so scroll events only
  // reach the sheet's own scroller ([data-sheet-scroll]). Only lock on our own
  // closed→open and unlock on our own open→closed transitions — never on another
  // sheet's state (both sheets stay mounted; the stats sheet is open while the
  // detail sheet's open is false).
  let wasOpen = false
  createEffect(() => {
    const open = props.open()
    if (open && !wasOpen) { wasOpen = true; scrollLock.lock(document) }
    else if (!open && wasOpen) { wasOpen = false; scrollLock.unlock(document) }
  })
  // Solid effects don't run on unmount — release the lock if we unmount while open.
  onCleanup(() => { if (wasOpen) scrollLock.unlock(document) })

  // open: snap off-screen then slide in next frame. Force a reflow (offsetHeight)
  // after mounting at translateY(100%) so the follow-up setPos(0) TRANSITIONS —
  // Firefox else coalesces mount+target style into the first frame and skips it.
  createEffect(() => {
    if (props.open()) {
      setClosing(false)
      setPos(1)
      if (sheetEl) void sheetEl.offsetHeight
      requestAnimationFrame(() => setPos(0))
    }
  })

  // close: slide out (transition on → smooth), then navigate back
  function dismiss() {
    setClosing(true)
    setPos(1)
    setTimeout(() => props.onDismiss(), 380)
  }

  // ---- drag-to-dismiss gesture (touch) ----------------------------------
  function setSheet(el: HTMLDivElement | null) {
    if (!el) { sheetEl = el; return }
    sheetEl = el
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false }) // need preventDefault
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onCancel, { passive: true })
  }

  function onStart(e: TouchEvent) {
    if (!sheetEl) return
    const t = e.touches[0]
    startY = t.clientY
    SAMPLES.length = 0
    SAMPLES.push({ t: performance.now(), y: t.clientY })
    const scroller = sheetEl.querySelector('[data-sheet-scroll]')
    startScrollTop = scroller ? scroller.scrollTop : 0
  }

  function onMove(e: TouchEvent) {
    if (!sheetEl) return
    const t = e.touches[0]
    const dy = t.clientY - startY
    if (startScrollTop <= 0 && dy > 0) {
      e.preventDefault()
      setDragging(true)
      const h = sheetEl.offsetHeight || window.innerHeight
      setPos(Math.min(Math.max(0, dy) / h, 1))
      SAMPLES.push({ t: performance.now(), y: t.clientY })
      if (SAMPLES.length > 10) SAMPLES.shift()
    }
  }

  function onEnd() {
    if (!dragging()) return
    const now = performance.now()
    // windowed slope over the most recent ~120ms of movement
    let vy = 0
    let i = SAMPLES.length - 1
    while (i > 0 && now - SAMPLES[i].t < 120) i--
    const latest = SAMPLES[SAMPLES.length - 1]
    const earliest = SAMPLES[i]
    const dt = latest.t - earliest.t
    if (dt > 0) vy = (latest.y - earliest.y) / dt
    setDragging(false)
    // dragged past the threshold OR flung fast → dismiss; otherwise snap back
    if (pos() > 0.35 || vy > 0.35) dismiss()
    else setPos(0)
  }

  function onCancel() {
    if (dragging()) { setDragging(false); setPos(0) }
    SAMPLES.length = 0
  }

  return (
    <Show when={props.open()}>
      <div class="fixed inset-0 z-50">
        {/* dimmed, blurred backdrop — only outside the solid card */}
        <div
          class={`absolute inset-0 bg-black/30 backdrop-blur-md ${closing() ? 'overlay-fade-out' : 'overlay-fade-in'}`}
        />
        {/* sheet: solid card slides up from bottom (in) / down (out)
            mobile → full-width/full-height modal; desktop → centered rounded card */}
        <div
          ref={setSheet}
          class="absolute inset-0 flex items-center justify-center sm:px-6 sm:py-6"
          style={{
            transform: `translateY(${pos() * 100}%)`,
            transition: dragging() ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        >
          <div class="relative w-full h-full bg-canvas overflow-hidden sm:max-w-190 sm:h-[calc(100vh-3rem)] sm:rounded-2xl sm:shadow-2xl">
            {props.children(dismiss)}
          </div>
        </div>
      </div>
    </Show>
  )
}
