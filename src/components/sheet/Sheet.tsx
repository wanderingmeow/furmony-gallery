import { createEffect, createMemo, createSignal, onCleanup, Show, type JSX } from 'solid-js'
import { scrollLock } from '../../draw/scrollLock'
import { EASE, prefersReducedMotion, SHEET_MOVE_MS, ease } from '../../draw/anim'
import { MAX_SAMPLES, flingVelocity, shouldDismiss, type Sample } from '../../draw/fling'

// The sheet that Detail and Stats share. It slides up from the bottom, the backdrop behind
// it dims and blurs, and the list under it stops scrolling. You can also close it by
// dragging the content down, but only once the content is already at its top. children,
// header and footer are render props that receive `dismiss`, so each sheet wires its own
// close button.

// The slide runs 300ms, the length it was tuned to first. Scrolling the content back and
// changing the height of the table run beside it, and those two share SHEET_MOVE_MS.
const SLIDE_MS = 300

// Wait for the slide to finish before the route changes. Moving earlier makes the sheet
// disappear before it reaches the bottom of the screen.
const DISMISS_WAIT_MS = SLIDE_MS + 80

// How far down the sheet has to travel before the top corners are fully round, as a
// fraction of the sheet's height. About 100px on a phone: the corners finish rounding long
// before a drag counts as closing it, which is what shouldDismiss decides.
const CORNER_TRAVEL = 0.12

// Marks the sheet's own scroll container, so the functions below can find it from outside
// the component.
const SCROLLER = '[data-sheet-scroll]'

let scrollRaf = 0
let stopYielding: (() => void) | null = null

/**
 * Scroll the sheet's content back to the top after the content changes in place, which is
 * what tapping a related setting does. Without this, the new setting opens at the depth you
 * left the last one at. That setting sits at the bottom of the sheet, so the change looks
 * like nothing happened.
 *
 * Call this after the new content is in place. Setting scrollTop to 0 before the navigation
 * stops the animation, and the browser can leave scrollTop stuck at the height of the old
 * content.
 *
 * We drive the scroll by hand instead of using behavior:'smooth', because that lets each
 * browser choose its own duration, and then the scroll and the CSS transition on the sheet
 * do not finish together.
 */
export function scrollSheetToTop(): void {
  const el = document.querySelector<HTMLElement>(SCROLLER)
  if (!el) return
  cancelAnimationFrame(scrollRaf)
  stopYielding?.()
  stopYielding = null

  const from = el.scrollTop
  if (from <= 0) return
  if (prefersReducedMotion()) {
    el.scrollTop = 0
    return
  }

  // If the user starts scrolling, give them the scroll position and stop here.
  const giveUp = () => {
    cancelAnimationFrame(scrollRaf)
    stopYielding?.()
    stopYielding = null
  }
  el.addEventListener('wheel', giveUp, { passive: true })
  el.addEventListener('touchstart', giveUp, { passive: true })
  stopYielding = () => {
    el.removeEventListener('wheel', giveUp)
    el.removeEventListener('touchstart', giveUp)
  }

  const t0 = performance.now()
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / SHEET_MOVE_MS)
    el.scrollTop = from * (1 - ease(k))
    if (k < 1) {
      scrollRaf = requestAnimationFrame(step)
      return
    }
    stopYielding?.()
    stopYielding = null
  }
  scrollRaf = requestAnimationFrame(step)
}

export function Sheet(props: {
  open: () => boolean
  onDismiss: () => void
  // Both sit outside the scroller, so the content cannot scroll over them. The detail
  // toolbar used to be a sticky bar inside the scroller: it covered the full width, and on
  // Safari that hid the scrollbar.
  header?: (dismiss: () => void) => JSX.Element
  footer?: (dismiss: () => void) => JSX.Element
  children: (dismiss: () => void) => JSX.Element
}) {
  // props.open is usually `() => !!useMatch(...)`. A new id gives a new match object, so the
  // boolean does not change, but reading the match still marks the effects below dirty, and
  // the sheet plays its opening animation again. This memo stops that, because its value
  // only changes when the boolean does.
  const open = createMemo(() => props.open())
  const [closing, setClosing] = createSignal(false)
  const [pos, setPos] = createSignal(1)
  const [dragging, setDragging] = createSignal(false)
  let sheetEl: HTMLDivElement | null = null
  let startY = 0
  let startScrollTop = 0
  const samples: Sample[] = []

  // Hold the document still while the sheet is open, so a wheel or touch over the backdrop
  // does not scroll the list behind it. release() is safe to call twice, and scrollLock
  // counts how many sheets hold the lock, so each open pairs with one release.
  createEffect(() => {
    if (!open()) return
    // A getter rather than a fixed element: the content can mount later than the lock does
    // (StatsLazy loads on demand), so we look up the scroller when the touch arrives.
    const release = scrollLock.acquire({
      document,
      getScrollable: () => sheetEl?.querySelector(SCROLLER) ?? null,
    })
    onCleanup(release)
  })

  // Firefox folds the mount style and the target style into one frame, so the transition has
  // no start value and the sheet jumps in. Reading offsetHeight forces a layout between the
  // two, and then the slide happens.
  createEffect(() => {
    if (!open()) return
    setClosing(false)
    setPos(1)
    if (sheetEl) void sheetEl.offsetHeight
    requestAnimationFrame(() => setPos(0))
  })

  // The top corners round as the sheet comes away from the bottom of the screen. Only the
  // drag and the exit should round them: opening also moves pos from 1 to 0, and the sheet
  // should arrive with square corners.
  const pull = () => (dragging() || closing() ? Math.min(1, pos() / CORNER_TRAVEL) : 0)

  function dismiss() {
    setClosing(true)
    setPos(1)
    setTimeout(() => props.onDismiss(), DISMISS_WAIT_MS)
  }

  // The drag listeners sit on the sheet's own scroller, not on the full-screen layer, so a
  // drag on the backdrop never closes the sheet.
  function setScroller(el: HTMLDivElement | null) {
    if (!el) return
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false }) // needs preventDefault
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onCancel, { passive: true })
  }

  function onStart(e: TouchEvent) {
    startY = e.touches[0].clientY
    startScrollTop = (e.currentTarget as HTMLElement).scrollTop
    samples.length = 0
    samples.push({ t: performance.now(), y: startY })
  }

  function onMove(e: TouchEvent) {
    if (!sheetEl) return
    const dy = e.touches[0].clientY - startY
    // Take over the gesture only once the content cannot scroll up any more. Before that, a
    // drag downward just scrolls the content, which is what the user expects.
    if (startScrollTop > 0 || dy <= 0) return
    e.preventDefault()
    setDragging(true)
    const h = sheetEl.offsetHeight || window.innerHeight
    setPos(Math.min(Math.max(0, dy) / h, 1))
    samples.push({ t: performance.now(), y: e.touches[0].clientY })
    if (samples.length > MAX_SAMPLES) samples.shift()
  }

  function onEnd() {
    if (!dragging()) return
    setDragging(false)
    if (shouldDismiss(pos(), flingVelocity(samples, performance.now()))) dismiss()
    else setPos(0)
  }

  function onCancel() {
    if (dragging()) {
      setDragging(false)
      setPos(0)
    }
    samples.length = 0
  }

  return (
    <Show when={open()}>
      <div class="fixed inset-0 z-50">
        <div
          class={`absolute inset-0 bg-black/30 backdrop-blur-md ${closing() ? 'overlay-fade-out' : 'overlay-fade-in'}`}
        />
        <div
          ref={(el) => { sheetEl = el }}
          class="absolute inset-0 flex items-center justify-center sm:px-6 sm:py-6"
          style={{
            transform: `translateY(${pos() * 100}%)`,
            transition: dragging() ? 'none' : `transform ${SLIDE_MS}ms ${EASE}`,
          }}
        >
          <div
            class="sheet-card relative w-full h-full bg-canvas overflow-hidden sm:max-w-190 sm:h-[calc(100vh-3rem)] sm:shadow-2xl flex flex-col"
            style={{
              '--sheet-pull': `${pull()}`,
              // The finger sets the radius, so nothing may lag behind it. After a release the
              // radius eases along with the slide.
              transition: dragging() ? 'none' : `border-radius ${SLIDE_MS}ms ${EASE}`,
            }}
          >
            {props.header && <div class="shrink-0">{props.header(dismiss)}</div>}
            <div
              data-sheet-scroll=""
              ref={setScroller}
              // overflow-y alone makes the other axis compute to auto, so a child that sticks
              // out by a pixel would let the whole sheet slide sideways. Only the related row
              // moves sideways, and it has its own scroller.
              //
              // We also turn off scroll anchoring. When the content changes, the table above
              // the viewport changes height, and anchoring rewrites scrollTop every frame to
              // hide that. On Safari it also undoes what the scroll animation writes. We
              // manage this element's scroll position ourselves, so anchoring has nothing
              // here to fix.
              style={{ 'overflow-anchor': 'none' }}
              class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
            >
              {props.children(dismiss)}
            </div>
            {props.footer && <div class="shrink-0">{props.footer(dismiss)}</div>}
          </div>
        </div>
      </div>
    </Show>
  )
}
