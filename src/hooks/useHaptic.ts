// src/hooks/useHaptic.ts - make a control's taps buzz, and keep the switch that buzzes in
// step with the value the control shows.
import { createEffect, on, onCleanup } from "solid-js";
import { hapticTap } from "../draw/haptics";

/** Make taps on `el` buzz, and keep its switch on the side that `lit` says. The reader's tap turns
 *  that switch whether or not the control took the tap, so the page writes its value back into it.
 *  Call this from the control's `ref`, and give the control a positioned box (`relative`): otherwise
 *  the label reaches the nearest positioned box and takes taps meant for a neighbor. `mute` disables
 *  the hidden switch while the control cannot take the tap. Returns the function that sets the
 *  switch right now.
 */
export function useHaptic(
  el: HTMLElement,
  lit: () => boolean,
  mute?: () => boolean,
): () => void {
  const buzz = hapticTap(el);
  if (!buzz) return () => {};
  const place = (quiet: boolean, isLit: boolean): void => {
    buzz.disabled = quiet;
    buzz.checked = isLit;
  };
  // Both values come from the source, so the phase that writes the switch reads no signal.
  createEffect(
    on([() => !!mute?.(), lit], ([quiet, isLit]) => place(quiet, isLit)),
  );
  const sync = (): void => place(!!mute?.(), lit());
  buzz.addEventListener("change", sync);
  onCleanup(() => buzz.removeEventListener("change", sync));
  return sync;
}
