import { createEffect, createSignal, Show } from 'solid-js'
import { Detail } from '../routes/Detail'

// iOS-style bottom sheet with drag-to-dismiss.
//
// Sheet position is driven by a `pos` signal (0 = shown, 1 = off-screen) instead
// of CSS keyframes so the open/close animation is INTERRUPTIBLE: a drag flips the
// transition to 'none' and takes over mid-animation. Dismiss needs either enough
// drag distance OR a fast downward flick (windowed velocity) — otherwise it snaps
// back.
//
// The gesture is touch-only and engages ONLY when the sheet content is at its top
// (scrollTop 0), so dragging down scrolls the content natively when it's not —
// never mixed with the detail's internal scroll.
export function DetailSheet(props: { open: () => boolean; onDismiss: () => void }) {
  const [closing, setClosing] = createSignal(false)
  const [pos, setPos] = createSignal(1)
  const [dragging, setDragging] = createSignal(false)

  // open: snap to off-screen then slide in on the next frame (transition on → smooth)
  createEffect(() => {
    if (props.open()) {
      setClosing(false)
      setPos(1)
      requestAnimationFrame(() => setPos(0))
    }
  })

  // dismiss: slide out (transition on → smooth), then tell the shell to navigate back
  function dismiss() {
    setClosing(true)
    setPos(1)
    setTimeout(() => props.onDismiss(), 380)
  }

  // ---- drag-to-dismiss gesture -------------------------------------------
  let sheetEl: HTMLDivElement | null = null
  let startY = 0
  let startScrollTop = 0
  // velocity samples for a windowed slope — more robust flick detection than the
  // last segment (fast swipe below the distance threshold still dismisses)
  const SAMPLES: { t: number; y: number }[] = []

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
    const scroller = sheetEl.querySelector('[data-detail-scroll]')
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
    // dragged past the threshold OR flung fast → dismiss (fast swipe below the
    // distance threshold still closes); otherwise snap back
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
        {/* sheet: solid white card slides up from bottom (in) / down (out)
            mobile → full-width/full-height iPhone-style modal; desktop → centered rounded card
            position driven by the pos/dragging signals — drags interrupt the animation */}
        <div
          ref={setSheet}
          class="absolute inset-0 flex items-center justify-center sm:px-6 sm:py-6"
          style={{
            transform: `translateY(${pos() * 100}%)`,
            transition: dragging() ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        >
          <div class="relative w-full h-full bg-white overflow-hidden sm:max-w-190 sm:h-[calc(100vh-3rem)] sm:rounded-2xl sm:shadow-2xl">
            <Detail onClose={dismiss} />
          </div>
        </div>
      </div>
    </Show>
  )
}
