// src/draw/holdPointer.ts: keep one element's pointer events from a press to its release.
//
// A finger drifts out of a small target mid-drag: the price slider's seek strips are 44px wide
// inside a 26px row, and shrink further where its two ends crowd. Holding the pointer keeps every
// move, and the release, coming to the element the press started on.

/** Hold `pointerId` on `el` until it is let go or cancelled: each move runs `onMove` with its page
 *  x, and the release or cancel runs `onStop` once. */
export function holdPointer(
  el: HTMLElement,
  pointerId: number,
  onMove: (clientX: number) => void,
  onStop: () => void,
): void {
  const onPointerMove = (event: PointerEvent) => onMove(event.clientX)
  const stop = () => {
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', stop)
    el.removeEventListener('pointercancel', stop)
    onStop()
  }
  el.setPointerCapture?.(pointerId)
  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerup', stop)
  el.addEventListener('pointercancel', stop)
}
