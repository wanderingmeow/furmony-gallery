// src/hooks/useHaptic.ts - make a control's taps buzz, and keep the switch that buzzes in
// step with the value the control shows.
import { createEffect, onCleanup } from "solid-js";
import { hapticTap } from "../draw/haptics";

/** Make taps on `el` buzz, and keep its switch on the side that `on` says. The reader's tap turns
 *  that switch whether or not the control took the tap, so the page writes its value back into it.
 *  Call this from the control's `ref`, and give the control a positioned box (`relative`): otherwise
 *  the label reaches the nearest positioned box and takes taps meant for a neighbor. Return the
 *  function that sets the switch right now. */
export function useHaptic(el: HTMLElement, on: () => boolean): () => void {
  const buzz = hapticTap(el);
  const sync = (): void => {
    if (buzz) buzz.checked = on();
  };
  if (!buzz) return sync;
  createEffect(sync);
  buzz.addEventListener("change", sync);
  onCleanup(() => buzz.removeEventListener("change", sync));
  return sync;
}
