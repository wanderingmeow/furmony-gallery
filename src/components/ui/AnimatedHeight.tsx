import { onCleanup, onMount, type JSX } from "solid-js";
import { EASE, prefersReducedMotion, SHEET_MOVE_MS } from "../../draw/anim";

/**
 * Slides from one height to the next, because the block under this one would otherwise snap:
 * swapping a detail changes the row count and the description length.
 *
 * The observer watches the inner element, whose natural height does not depend on how tall the
 * outer one is pinned, so an animation starts only when the content really changed.
 */
export function AnimatedHeight(props: {
  children: JSX.Element;
  /** The content settled at a different height, so anything measured against it has to look again. */
  onHeightChange?: () => void;
}) {
  let wrap!: HTMLDivElement;
  let inner!: HTMLDivElement;
  let anim: Animation | null = null;
  let pinned = 0;

  onMount(() => {
    const ro = new ResizeObserver(() => {
      const from = pinned;
      const h = inner.offsetHeight;
      if (h === from) return;
      pinned = h;
      wrap.style.height = `${h}px`;
      props.onHeightChange?.();
      if (from === 0 || prefersReducedMotion()) return;
      // WAAPI, not a CSS transition. This callback runs after layout and before paint, and
      // Safari folds the style write into the same recalculation, so a transition has no
      // start value and jumps straight to the new height. Chrome and Firefox do not. The
      // keyframes name both ends, which leaves Safari nothing to guess.
      anim?.cancel();
      anim = wrap.animate([{ height: `${from}px` }, { height: `${h}px` }], {
        duration: SHEET_MOVE_MS,
        easing: EASE,
      });
      // Anything measured against this wants the height the slide arrived at, not the one in flight.
      anim.finished.then(
        () => props.onHeightChange?.(),
        () => {},
      );
    });
    // Measure one frame in: layout is done by then, so the first height we pin is the real
    // one and the sheet does not open from 0.
    requestAnimationFrame(() => {
      pinned = inner.offsetHeight;
      wrap.style.height = `${pinned}px`;
      props.onHeightChange?.();
      ro.observe(inner);
    });
    onCleanup(() => {
      ro.disconnect();
      anim?.cancel();
    });
  });

  return (
    <div ref={wrap} class="overflow-hidden">
      <div ref={inner}>{props.children}</div>
    </div>
  );
}
