// The engine that ignores the viewport's zoom caps keeps pinch anyway, so it is held by hand here.

/** Legacy WebKit on an iPhone reached 5x with every element computing `pan-y`: it ignores the meta
 *  cap and answers `touch-action` for pinch only partly. The same property is read in
 *  src/data/persistence.ts, where a wrong answer only picks the wrong wording; here it decides
 *  whether the locks go on, and the engines that obey the caps keep the gesture they were given. */
export const ignoresZoomCaps = (): boolean =>
  CSS.supports("-webkit-touch-callout", "none");

/** A surface that runs its own pinch, so the second finger is its business. */
const OWN_PINCH = "[data-pinch-ok]";

/** Hold page pinch away. Either lock alone leaves a window where a pinch still starts, measured on
 *  an iPhone; both together hold. */
export function holdPinch(ignoresCaps = ignoresZoomCaps()): () => void {
  if (!ignoresCaps) return () => {};

  const stopGesture = (event: Event) => event.preventDefault();

  const cancelSecondFinger = (event: TouchEvent) => {
    if (event.touches.length < 2) return;
    const target = event.target;
    if (target instanceof Element && target.closest(OWN_PINCH)) return;
    event.preventDefault();
  };

  document.addEventListener("gesturestart", stopGesture, { passive: false });
  document.addEventListener("touchstart", cancelSecondFinger, {
    passive: false,
    capture: true,
  });
  document.addEventListener("touchmove", cancelSecondFinger, {
    passive: false,
    capture: true,
  });

  return () => {
    document.removeEventListener("gesturestart", stopGesture);
    document.removeEventListener("touchstart", cancelSecondFinger, {
      capture: true,
    });
    document.removeEventListener("touchmove", cancelSecondFinger, {
      capture: true,
    });
  };
}
