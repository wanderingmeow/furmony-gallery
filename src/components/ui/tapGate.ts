// src/components/ui/tapGate.ts - tells whether a touch was one tap.
//
// A full-screen picture closes on a single tap, the way the Photos app does. The gestures that
// must not close it happen on the same picture: a pan moves it, and a pinch has two fingers that
// go down together and lift at different times. So the gate counts fingers and measures the press.
// It does not depend on any single event name, because engines disagree about which events a
// gesture produces.
//
// `watchTaps` listens on the window: a finger can leave the picture while it is still down, so
// the release does not always arrive at the picture. The caller says which targets it owns: a
// press on a button above the picture is not a tap on the picture.

/** The part of a pointer event that the gate reads. A real `PointerEvent` fits it as it is. */
export type TapPointer = {
  target: EventTarget | null
  timeStamp: number
  clientX: number
  clientY: number
}

/** How long a press still counts as a tap. Past it the reader is holding, not tapping. */
const TAP_MS = 400

/** How far a finger may drift while it is down. A pan moves the picture by more than this. */
const TAP_SLOP = 10

export type TapGate = {
  /** For every `pointerdown`. Call it in the capture phase: a listener on the element can stop
   *  the press from bubbling, and then it never reaches here. */
  down(event: TapPointer): void
  /** For every `pointerup`. Register it where the release always arrives: the window. */
  up(event: TapPointer): void
  /** For every `pointercancel`. */
  cancel(): void
}

/** Watches presses and calls `onTap` once for a single tap on a watched target. */
export function makeTapGate(opts: {
  /** Whether this press landed on something that the caller watches. */
  owns: (target: EventTarget | null) => boolean
  onTap: () => void
}): TapGate {
  let fingers = 0
  let extraFinger = false
  let onWatched = false
  let downTime = 0
  let downX = 0
  let downY = 0

  return {
    down(event) {
      fingers += 1
      if (fingers > 1) extraFinger = true
      onWatched = opts.owns(event.target)
      if (!onWatched) return
      downTime = event.timeStamp
      downX = event.clientX
      downY = event.clientY
    },

    up(event) {
      fingers = Math.max(0, fingers - 1)
      const stillHeld = fingers > 0
      const heldMs = event.timeStamp - downTime
      const drifted = Math.max(Math.abs(event.clientX - downX), Math.abs(event.clientY - downY))
      const tapped = onWatched && !extraFinger && !stillHeld
        && heldMs <= TAP_MS && drifted <= TAP_SLOP
      if (!stillHeld) { extraFinger = false; onWatched = false }
      if (tapped) opts.onTap()
    },

    // The browser takes a gesture over (a system swipe, or the OS reclaiming the touch) and never
    // says what the reader meant, so this only resets.
    cancel() { fingers = 0; extraFinger = false; onWatched = false },
  }
}

/** Watch the window for a single tap, and call `onTap` once for each tap. It reads the press in
 *  the capture phase, because a widget that pans the picture stops it from bubbling. Returns the
 *  call that stops watching. */
export function watchTaps(opts: {
  owns: (target: EventTarget | null) => boolean
  onTap: () => void
}): () => void {
  const gate = makeTapGate(opts)
  window.addEventListener('pointerdown', gate.down, true)
  window.addEventListener('pointerup', gate.up)
  window.addEventListener('pointercancel', gate.cancel)
  return () => {
    window.removeEventListener('pointerdown', gate.down, true)
    window.removeEventListener('pointerup', gate.up)
    window.removeEventListener('pointercancel', gate.cancel)
  }
}
