// Keep a press's moves coming to one place until it is let go. A finger drifts out of a small target
// mid-drag: the seek strips of the price slider are 44px wide inside a 26px row, and they shrink
// further where the two ends crowd.
//
// Two ways to do that, and the difference is whether the browser owns the gesture.

/** Take the moves and the release from `target`, for the pointers that `mine` accepts, until one of
 *  them is released or cancelled. Return the function that stops listening, without running
 *  `onStop`. */
function track(
  target: EventTarget,
  mine: (event: PointerEvent) => boolean,
  onMove: (clientX: number, clientY: number) => void,
  onStop: () => void,
): () => void {
  const pointer =
    (run: (event: PointerEvent) => void): EventListener =>
    (event) =>
      run(event as PointerEvent);
  const onPointerMove = pointer((event) => {
    if (mine(event)) onMove(event.clientX, event.clientY);
  });
  const onRelease = pointer((event) => {
    if (!mine(event)) return;
    detach();
    onStop();
  });
  function detach(): void {
    target.removeEventListener("pointermove", onPointerMove);
    target.removeEventListener("pointerup", onRelease);
    target.removeEventListener("pointercancel", onRelease);
  }
  target.addEventListener("pointermove", onPointerMove);
  target.addEventListener("pointerup", onRelease);
  target.addEventListener("pointercancel", onRelease);
  return detach;
}

/** Capture `pointerId` on `el`, so every move and the release come to `el` after the finger walks
 *  off. Capture takes the gesture away from the browser's own hit test, so nothing under the finger
 *  gets it - not a buzz label either. */
export function holdPointer(
  el: HTMLElement,
  pointerId: number,
  onMove: (clientX: number, clientY: number) => void,
  onStop: () => void,
): void {
  el.setPointerCapture?.(pointerId);
  track(el, () => true, onMove, onStop);
}

/** Follow `pointerId` on the document, and leave the browser in charge of the gesture: the buzz
 *  Safari gives needs the browser's own hit test (draw/haptics.ts), so a control that buzzes cannot
 *  capture. These listeners outlive the control that started them, so a control that goes away
 *  mid-drag has to call the returned function. */
export function followPointer(
  pointerId: number,
  onMove: (clientX: number, clientY: number) => void,
  onStop: () => void,
): () => void {
  return track(
    document,
    (event) => event.pointerId === pointerId,
    onMove,
    onStop,
  );
}
