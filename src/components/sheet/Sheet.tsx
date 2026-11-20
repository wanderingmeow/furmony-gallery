import { createEffect, createMemo, createSignal, on, onCleanup, Show, untrack, type JSX } from 'solid-js'
import { scrollLock } from '../../draw/scrollLock'
import { EASE, prefersReducedMotion, SHEET_MOVE_MS, ease } from '../../draw/anim'
import { MAX_SAMPLES, flingVelocity, shouldDismiss, type Sample } from '../../draw/fling'
import { CARD_BAND_PAD, cardGap, SCROLL_BAND_PAD, shapeAt, SPREAD_MAX_W } from '../../draw/layout'
import { watchViewport } from '../ui/viewport'
import { SheetFooterSlot } from '../ui/boxes'

// The sheet that Detail and Stats share. It slides up from the bottom, the backdrop behind
// it dims and blurs, and the list under it stops scrolling. You can also close it by
// dragging the content down, but only once the content is already at its top. children and
// header are render props that receive `dismiss`, so each sheet wires its own close button.
// The foot box is empty until a screen claims it: see useSheetFooter.

// The slide runs 300ms, the length it was tuned to first. Scrolling the content back and
// changing the height of the table run beside it, and those two share SHEET_MOVE_MS.
const SLIDE_MS = 300
// A sheet that sits in from every edge has no bottom to come up from, so it fades in and grows a
// little instead. Shorter than the slide: a fade reads as slower than a move of the same length.
const FADE_MS = 180

// Wait for the arrival to finish before the route changes. Moving earlier makes the sheet
// disappear before it reaches the bottom of the screen, or before it has faded out.
const SETTLE_MS = (ms: number): number => ms + 80

// How far down the sheet has to travel before the top corners are fully round, as a
// fraction of the sheet's height. About 100px on a phone: the corners finish rounding long
// before a drag counts as closing it, which is what shouldDismiss decides.
const CORNER_TRAVEL = 0.12

// Marks the sheet's own scroll container, so the functions below can find it from outside
// the component.
const SCROLLER = '[data-sheet-scroll]'
// The right column of a panel, which scrolls on its own so the picture stays where it is while the
// table and the related row move.
export const COL_SCROLLER = '[data-sheet-col-scroll]'

let scrollRaf = 0
let stopYielding: (() => void) | null = null

/** Scroll the sheet's content back to the top after the content changes in place, which is what
 *  tapping a related listing does: the new listing sits at the bottom of the sheet, so without this
 *  the change looks like nothing happened. Call it once the new content is in place - before that,
 *  the browser can leave scrollTop stuck at the height of the old content. The scroll is driven by
 *  hand rather than behavior:'smooth', so it ends together with the sheet's own transition.
 */
export function scrollSheetToTop(): void {
  const el =
    document.querySelector<HTMLElement>(COL_SCROLLER) ?? document.querySelector<HTMLElement>(SCROLLER)
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
  // The header and the foot box sit outside the scroller, so nothing scrolls over them and a bar
  // never covers the scrollbar.
  header?: (dismiss: () => void) => JSX.Element
  children: (dismiss: () => void) => JSX.Element
}) {
  // props.open is usually `() => !!useMatch(...)`. A new id gives a new match object, so the
  // boolean does not change, but reading the match still marks the effects below dirty, and
  // the sheet plays its opening animation again. This memo stops that, because its value
  // only changes when the boolean does.
  const open = createMemo(() => props.open())
  // A landscape screen shows this as a panel in from every edge; see shapeAt.
  const { viewportW, viewportH } = watchViewport()
  const insets = () => `${cardGap(viewportW(), viewportH())}px`
  const panel = () => shapeAt(viewportW(), viewportH()) === 'panel'
  const inset = () => cardGap(viewportW(), viewportH())
  const moveMs = () => (panel() ? FADE_MS : SLIDE_MS)
  // The box that a screen's bottom bar travels into. Appending the node on every open moves it
  // back into the sheet, and the bar inside it moves with it.
  const footerHost = document.createElement('div')
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
  createEffect(on(open, (shown) => {
    if (!shown) return
    // The content can mount later than the lock does (StatsLazy loads on demand), so the scroller is
    // looked up when the touch arrives. The innermost one: in a panel the finger is on the right
    // column.
    const release = scrollLock.acquire({
      document,
      getScrollable: () =>
        sheetEl?.querySelector<HTMLElement>(COL_SCROLLER) ??
        sheetEl?.querySelector<HTMLElement>(SCROLLER) ??
        null,
    })
    onCleanup(release)
  }))

  // Firefox folds the mount style and the target style into one frame, so the transition has
  // no start value and the sheet jumps in. Reading offsetHeight forces a layout between the
  // two, and then the slide happens.
  createEffect(on(open, (shown) => {
    if (!shown) return
    setClosing(false)
    setPos(1)
    if (sheetEl) void sheetEl.offsetHeight
    requestAnimationFrame(() => setPos(0))
  }))

  // The layer keeps its own signal: a back press moves the route away from outside, and the
  // layer still has one slide to finish.
  const [shown, setShown] = createSignal(untrack(open))
  let exitTimer: number | undefined

  function slideOut(settle: () => void) {
    setClosing(true)
    setPos(1)
    clearTimeout(exitTimer)
    exitTimer = setTimeout(settle, SETTLE_MS(moveMs()))
  }
  onCleanup(() => clearTimeout(exitTimer))

  // ✕ or a fling: the route still points here, so it changes once the slide is over.
  function dismiss() {
    slideOut(() => {
      setShown(false)
      // A back press during the slide already moved the route away.
      if (open()) props.onDismiss()
    })
  }

  createEffect(
    on(
      open,
      (isOpen) => {
        if (isOpen) {
          setShown(true)
          return
        }
        if (!shown() || closing()) return // nothing on screen, or a slide is running
        // The route moved away while the layer was up: wait out the slide, then drop it.
        slideOut(() => {
          // The route came back during the slide, so the sheet simply stays.
          if (open()) {
            setClosing(false)
            setPos(0)
            return
          }
          setShown(false)
        })
      },
      { defer: true },
    ),
  )

  // The top corners round as the sheet comes away from the bottom of the screen. Only the
  // drag and the exit should round them: opening also moves pos from 1 to 0, and the sheet
  // should arrive with square corners.
  const pull = () => (dragging() || closing() ? Math.min(1, pos() / CORNER_TRAVEL) : 0)

  // The drag listeners sit on the sheet's own scroller, not on the full-screen layer, so a
  // drag on the backdrop never closes the sheet. A panel that sits in from every edge is not
  // dismissed by a drag at all: nothing below it is off the screen. Both the element and the
  // arrangement can change - the sheet is mounted again on each open, and a phone can be turned -
  // so this runs on either.
  const [scroller, setScroller] = createSignal<HTMLDivElement | null>(null)
  createEffect(
    on([scroller, panel], ([el, isPanel]) => {
      if (!el || isPanel) return
      el.addEventListener('touchstart', onStart, { passive: true })
      el.addEventListener('touchmove', onMove, { passive: false }) // needs preventDefault
      el.addEventListener('touchend', onEnd, { passive: true })
      el.addEventListener('touchcancel', onCancel, { passive: true })
      onCleanup(() => {
        el.removeEventListener('touchstart', onStart)
        el.removeEventListener('touchmove', onMove)
        el.removeEventListener('touchend', onEnd)
        el.removeEventListener('touchcancel', onCancel)
      })
    }),
  )

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
    <Show when={shown()}>
      <div class="fixed inset-0 z-[60]">
        <div
          data-sheet-backdrop=""
          class={`absolute inset-0 bg-black/30 backdrop-blur-md ${closing() ? 'overlay-fade-out' : 'overlay-fade-in'}`}
          // Only a mouse gets this. A finger cannot see where the panel ends behind its own pad,
          // and on the shortest screens there is no gap to aim at.
          onPointerUp={(e) => {
            if (panel() && e.pointerType !== 'touch') dismiss()
          }}
        />
        <div
          ref={(el) => { sheetEl = el }}
          class="absolute inset-0 flex items-center justify-center sm:px-6 sm:py-6"
          style={
            panel()
              ? {
                  padding: insets(),
                  opacity: `${1 - pos()}`,
                  transform: `scale(${1 - 0.03 * pos()})`,
                  transition: `opacity ${FADE_MS}ms ${EASE}, transform ${FADE_MS}ms ${EASE}`,
                }
              : {
                  transform: `translateY(${pos() * 100}%)`,
                  transition: dragging() ? 'none' : `transform ${SLIDE_MS}ms ${EASE}`,
                }
          }
        >
          <div
            class={`sheet-card relative w-full h-full bg-canvas clip-no-scroll flex flex-col
              ${CARD_BAND_PAD} sm:max-w-190 sm:h-[calc(100vh-3rem)] sm:shadow-2xl`}
            style={{
              '--sheet-pull': `${pull()}`,
              // The finger sets the radius, so nothing may lag behind it. After a release the
              // radius eases along with the slide.
              transition: dragging() ? 'none' : `border-radius ${SLIDE_MS}ms ${EASE}`,
              ...(panel() ? { 'max-width': `${SPREAD_MAX_W}px`, height: '100%' } : null),
              // With no gap there is no edge to round: the corners would only show the backdrop.
              ...(inset() === 0 ? { 'border-radius': '0px' } : null),
            }}
          >
            <SheetFooterSlot.Provider value={footerHost}>
              {props.header && <div class="shrink-0">{props.header(dismiss)}</div>}
              <div
                data-sheet-scroll=""
                ref={setScroller}
                // overflow-y alone makes the other axis compute to auto, so a child that sticks
                // out by a pixel would let the whole sheet slide sideways. Only the related row
                // moves sideways, and it has its own scroller.
                //
                // Scroll anchoring is off: the rows above grow as they load, and anchoring
                // rewrites scrollTop to follow them. On Safari it also undoes the scroll
                // position we write ourselves.
                style={{ 'overflow-anchor': 'none' }}
                class={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${SCROLL_BAND_PAD}`}
              >
                {props.children(dismiss)}
              </div>
              <div class="shrink-0" data-sheet-footer="" ref={(el) => el.appendChild(footerHost)} />
            </SheetFooterSlot.Provider>
          </div>
        </div>
      </div>
    </Show>
  )
}
