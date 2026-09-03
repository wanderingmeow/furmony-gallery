// src/scrollLock.ts — ref-counted document scroll lock.
//
// Layers (CSS is the PRIMARY mechanism, JS is only the fallback):
//
//   PRIMARY (declared before any gesture, in CSS):
//     - the sheet scroller has `touch-action: pan-y` + `overscroll-behavior: contain`,
//       so it scrolls freely and never chains to the page behind it
//     - `html[data-scroll-locked], body[data-scroll-locked]` pin the document
//       (`overflow: hidden` + `scrollbar-gutter: stable`)
//     This covers Android / modern PC.
//
//   FALLBACK (iOS Safari / older browsers, where body `overflow: hidden` is
//   ignored): we ALSO set inline overflow on html+body and intercept the touch
//   gesture (touchstart/touchmove/touchend/touchcancel), preventDefault only the
//   moves that would scroll the locked document. `window.scrollY` stays untouched —
//   the waterfall's virtualization reads it, so NO `position: fixed`.
//
// API: `acquire(options) => release()`. Each acquire returns an idempotent release,
// so nesting is a simple ref-count and there is no lock/unlock target-pairing to
// get wrong — one instance serves one document (the default).
//
// The document is injected (a seam) so the logic is unit-testable without a real
// DOM. The app uses the exported `scrollLock` singleton with the real `document`.

export interface Scrollable {
  contains(node: Node): boolean
  scrollTop: number
  clientHeight: number
  scrollHeight: number
}

export interface ScrollTarget {
  documentElement: { style: { overflow: string }; dataset?: { scrollLocked?: string } }
  body: { style: { overflow: string }; dataset?: { scrollLocked?: string } }
  addEventListener?: (type: string, handler: (e: TouchEvent) => void, opts?: AddEventListenerOptions) => void
  removeEventListener?: (type: string, handler: (e: TouchEvent) => void, opts?: AddEventListenerOptions) => void
}

export interface ScrollLockOptions {
  document?: ScrollTarget
  getScrollable?: () => Scrollable | null
}

export interface ScrollLock {
  acquire(options?: ScrollLockOptions): () => void
  readonly count: number
}

// px tolerance so float scrollTop / sub-pixel edges don't misfire
const EPS = 1

export function createScrollLock(defaultDocument: ScrollTarget = document as unknown as ScrollTarget): ScrollLock {
  let count = 0
  let ownerDocument: ScrollTarget | null = null
  let handlers: { start: (e: TouchEvent) => void; move: (e: TouchEvent) => void; end: (e: TouchEvent) => void } | null = null
  let savedDocOverflow = ''
  let savedBodyOverflow = ''
  const getScrollables: Array<() => Scrollable | null> = []

  function makeHandlers(getScrollable: () => Scrollable | null) {
    let startX = 0
    let startY = 0
    let cached: Scrollable | null = null

    const start = (e: TouchEvent) => {
      // single-finger only; ignore multi-touch / empty
      if (e.touches.length !== 1) return
      // re-resolve the scroller for THIS gesture — never cache across gestures,
      // so a scroller that mounts later (lazy content) is picked up next touch
      cached = null
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
    }

    const move = (e: TouchEvent) => {
      if (!e.cancelable || e.touches.length !== 1) return
      const scrollable = cached ?? (cached = getScrollable())
      const target = e.target as Node | null
      // touches outside the sheet scroller would scroll the locked document — block
      if (!scrollable || !target || !scrollable.contains(target)) {
        e.preventDefault()
        return
      }
      // inside the scroller: allow, but stop at its edges so a further drag doesn't
      // chain to the page behind. Touch sign: finger UP (clientY drops, dy<0) scrolls
      // content DOWN, so at the TOP edge a DOWNWARD drag overscrolls upward (nothing
      // above) and at the BOTTOM edge an UPWARD drag overscrolls downward (nothing below).
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY
      if (Math.abs(dy) > Math.abs(dx)) {
        const atTop = scrollable.scrollTop <= EPS
        const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - EPS
        if ((dy > 0 && atTop) || (dy < 0 && atBottom)) {
          e.preventDefault()
        }
      }
    }

    const end = (_e: TouchEvent) => {
      startX = 0
      startY = 0
    }

    return { start, move, end }
  }

  return {
    acquire(options: ScrollLockOptions = {}): () => void {
      const doc = options.document ?? defaultDocument
      const getScrollable = options.getScrollable ?? (() => null)

      if (count === 0) {
        ownerDocument = doc
        savedDocOverflow = doc.documentElement.style.overflow
        savedBodyOverflow = doc.body.style.overflow
        doc.documentElement.style.overflow = 'hidden'
        doc.body.style.overflow = 'hidden'
        if (doc.documentElement.dataset) doc.documentElement.dataset.scrollLocked = ''
        if (doc.body.dataset) doc.body.dataset.scrollLocked = ''
        // resolve the scroller from the MOST RECENT acquire so a nested sheet's
        // content is allowed to scroll, not treated as locked background
        handlers = makeHandlers(() => {
          const top = getScrollables[getScrollables.length - 1]
          return top ? top() : null
        })
        doc.addEventListener?.('touchstart', handlers.start, { passive: true })
        doc.addEventListener?.('touchmove', handlers.move, { passive: false })
        doc.addEventListener?.('touchend', handlers.end, { passive: true })
        doc.addEventListener?.('touchcancel', handlers.end, { passive: true })
      }

      getScrollables.push(getScrollable)
      count++

      let released = false
      const release = () => {
        if (released) return
        released = true
        // remove THIS acquire's getter (pair it by identity, not the stack top)
        const idx = getScrollables.lastIndexOf(getScrollable)
        if (idx >= 0) getScrollables.splice(idx, 1)
        count = Math.max(0, count - 1)
        if (count === 0 && ownerDocument && handlers) {
          ownerDocument.documentElement.style.overflow = savedDocOverflow
          ownerDocument.body.style.overflow = savedBodyOverflow
          if (ownerDocument.documentElement.dataset) delete ownerDocument.documentElement.dataset.scrollLocked
          if (ownerDocument.body.dataset) delete ownerDocument.body.dataset.scrollLocked
          ownerDocument.removeEventListener?.('touchstart', handlers.start)
          ownerDocument.removeEventListener?.('touchmove', handlers.move)
          ownerDocument.removeEventListener?.('touchend', handlers.end)
          ownerDocument.removeEventListener?.('touchcancel', handlers.end)
          handlers = null
          ownerDocument = null
        }
      }

      return release
    },
    get count(): number {
      return count
    },
  }
}

export const scrollLock: ScrollLock = createScrollLock()
