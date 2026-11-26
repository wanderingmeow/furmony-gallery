// The finger's side of a knob that rides a track: which gesture a press turned out to be, where the
// knob stands, and the click the browser sends after a release. The moves are followed outside
// the element, because a finger drifts out of a small target mid-drag.
import { createMemo, createSignal, onCleanup } from "solid-js";
import { createAxisLock } from "../draw/axisLock";
import { followPointer } from "../draw/trackPointer";

export interface KnobDrag {
  held: () => boolean;
  /** px along the track. */
  x: () => number;
  /** The knob being past the middle is the value the control shows. */
  pastMiddle: () => boolean;
  /** A press does nothing while `live` is false. */
  press: (event: PointerEvent) => void;
  /** Whether the click the browser sends after a release still needs ignoring. The answer clears
   *  the flag, so only the first click is held back. */
  clickToIgnore: () => boolean;
}

export function useKnobDrag(
  travel: number,
  opts: {
    /** Whether the control may take the gesture. */
    live: () => boolean;
    value: () => boolean;
    /** Called with the value a release past the middle produced. */
    onChange: (on: boolean) => void;
    /** Runs at the end of every release, whether or not the value moved. */
    settled?: () => void;
  },
): KnobDrag {
  // How far the pointer has travelled since the press, or null while nothing is held.
  const [dragX, setDragX] = createSignal<number | null>(null);
  const [held, setHeld] = createSignal(false);
  const restX = () => (opts.value() ? travel : 0);
  const x = createMemo(() => {
    const d = dragX();
    if (d === null) return restX();
    return Math.min(Math.max(restX() + d, 0), travel);
  });
  const pastMiddle = createMemo(() => x() > travel / 2);

  let startX = 0;
  let startY = 0;
  let moved = false;
  // The browser sends a click after a release, which would turn the control a second time, so the
  // first one is ignored. A new press clears the flag.
  let ignoreClick = false;
  let stopFollow: (() => void) | null = null;
  const lock = createAxisLock();

  const moveTo = (x: number, y: number): void => {
    const dx = x - startX;
    const dy = y - startY;
    // Nothing moves until the axis is known: a drag the scroll ends up taking must never grow the
    // knob.
    const axis = lock.of(dx, dy);
    if (!axis) return;
    if (axis === "y") {
      // The scroll has the gesture from here, and the click this release sends must not turn the
      // control.
      stopFollow?.();
      stopFollow = null;
      ignoreClick = true;
      setHeld(false);
      return;
    }
    setHeld(true);
    moved = true;
    setDragX(dx);
  };

  const release = (): void => {
    const wanted = pastMiddle();
    stopFollow = null;
    setDragX(null);
    setHeld(false);
    if (moved) {
      ignoreClick = true;
      // The control can become disabled while the finger is down, and a disabled control takes no
      // value.
      if (opts.live() && wanted !== opts.value()) opts.onChange(wanted);
    }
    opts.settled?.();
  };

  const press = (event: PointerEvent): void => {
    if (!opts.live()) return;
    startX = event.clientX;
    startY = event.clientY;
    lock.reset();
    moved = false;
    ignoreClick = false;
    // A second finger takes the drag from the first: the first finger's listeners go, and with them
    // any travel it had reached, so the knob rests until the new finger moves.
    stopFollow?.();
    setDragX(null);
    setHeld(false);
    // eslint-disable-next-line solid/reactivity -- followPointer runs these when the finger moves
    stopFollow = followPointer(event.pointerId, moveTo, () => {
      stopFollow = null;
      release();
    });
  };

  const clickToIgnore = (): boolean => {
    if (!ignoreClick) return false;
    ignoreClick = false;
    return true;
  };

  onCleanup(() => stopFollow?.());

  return { held, x, pastMiddle, press, clickToIgnore };
}
