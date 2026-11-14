import { onCleanup, onMount, type JSX } from 'solid-js'
import { EASE, prefersReducedMotion, SHEET_MOVE_MS } from '../../draw/anim'

/**
 * Slides from one height to the next instead of jumping, because the block under it would
 * otherwise snap: swapping a detail changes the row count and the description length.
 *
 * The observer watches the inner element, whose natural height does not depend on how tall
 * we pin the outer one — so an animation starts only when the content really changed.
 */
export function AnimatedHeight(props: { children: JSX.Element }) {
  let wrap!: HTMLDivElement
  let inner!: HTMLDivElement
  let anim: Animation | null = null
  let pinned = 0

  onMount(() => {
    const ro = new ResizeObserver(() => {
      const from = pinned
      const h = inner.offsetHeight
      if (h === from) return
      pinned = h
      wrap.style.height = `${h}px`
      if (from === 0 || prefersReducedMotion()) return
      // WAAPI, not a CSS transition. This callback runs after layout and before paint, and
      // Safari folds the style write into the same recalculation, so a transition has no
      // start value and jumps straight to the new height. Chrome and Firefox do not. The
      // keyframes name both ends, which leaves Safari nothing to guess.
      anim?.cancel()
      anim = wrap.animate(
        [{ height: `${from}px` }, { height: `${h}px` }],
        { duration: SHEET_MOVE_MS, easing: EASE },
      )
    })
    // Measure one frame in: layout is done by then, so the first height we pin is the real
    // one and the sheet does not open from 0.
    requestAnimationFrame(() => {
      pinned = inner.offsetHeight
      wrap.style.height = `${pinned}px`
      ro.observe(inner)
    })
    onCleanup(() => {
      ro.disconnect()
      anim?.cancel()
    })
  })

  return (
    <div ref={wrap} class="overflow-hidden">
      <div ref={inner}>{props.children}</div>
    </div>
  )
}
