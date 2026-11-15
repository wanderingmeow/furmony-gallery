// src/components/ui/CollapseX.tsx - collapse horizontally in one beat: the content shrinks to
// a point and fades while its width gives way to the sibling beside it. Unmounting waits for
// the transition, so `mounted` trails `when`.
//
// The width is a grid column (1fr → 0fr), not a max-width: a max-width has to fall past the
// content's own width before anything moves, and that half of the beat was invisible.
// AnimatedHeight is the vertical answer to the same problem.
import { createEffect, createSignal, onCleanup, Show } from 'solid-js'
import type { JSX } from 'solid-js'
import { prefersReducedMotion } from '../../draw/anim'

const MS = 150
// The fade has to stay inside the window it is clipped by, or the cut lands on the glyphs.
// Hiding wants the fade to lead the width, showing wants it to lag, and the inequality flips
// with direction, so no single duration serves both.
const LEAD_MS = Math.round(MS * 0.7)
const LAG_MS = Math.round(MS / 0.7)

export function CollapseX(props: { when: boolean; children: JSX.Element }) {
  const [mounted, setMounted] = createSignal(props.when)
  const [open, setOpen] = createSignal(props.when)
  const [fadeMs, setFadeMs] = createSignal(LEAD_MS)
  let timer: ReturnType<typeof setTimeout> | null = null

  const reveal = () => {
    setFadeMs(LAG_MS)
    setMounted(true)
    setOpen(false)
    // Two frames: one to paint the collapsed state, one to start from it. A style set in the
    // frame an element mounts has nothing to transition from.
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)))
  }

  const hide = () => {
    setFadeMs(LEAD_MS)
    // The duration is set a frame before the property moves: in the same update the browser
    // may animate with the duration from before the flip.
    requestAnimationFrame(() => {
      setOpen(false)
      timer = setTimeout(() => setMounted(false), prefersReducedMotion() ? 0 : MS)
    })
  }

  // Compared by hand on purpose: `on(..., { defer: true })` records no initial value, so the
  // callback can run with the value unchanged and replay a whole collapse-and-reopen. Safari
  // paints that as a flash; Chrome hides it by folding the two class writes into one pass.
  let last = props.when
  createEffect(() => {
    const on = props.when
    if (on === last) return
    last = on
    if (timer) clearTimeout(timer)
    if (on) reveal()
    else hide()
  })

  onCleanup(() => { if (timer) clearTimeout(timer) })

  return (
    <Show when={mounted()}>
      {/* -ml-2 cancels the row's own gap, or a collapsed child would still cost 8px */}
      <div
        class="grid transition-[grid-template-columns,margin] ease-in-out motion-reduce:transition-none"
        style={{
          'grid-template-columns': open() ? '1fr' : '0fr',
          'transition-duration': `${MS}ms`,
        }}
        classList={{ 'ml-0': open(), '-ml-2': !open() }}
        aria-hidden={!props.when}
      >
        {/* Centred, so the closing edge meets the shrinking content in the middle - but only
            while the item still fits, which is what LEAD_MS and LAG_MS keep true. */}
        <div class="flex min-w-0 justify-center overflow-hidden">
          {/* scale-0, so the content shrinks out of view instead of fading in place. Tailwind
              v4 writes scale-* into the CSS `scale` property, so the transition has to name
              `scale`. nowrap: the column narrows past the buttons' own width, or the label
              would wrap to two lines while being clipped away. */}
          <div
            class="whitespace-nowrap transition-[opacity,scale] ease-in-out motion-reduce:transition-none"
            style={{ 'transition-duration': `${fadeMs()}ms` }}
            classList={{
              'opacity-100 scale-100': open(),
              'opacity-0 scale-0': !open(),
            }}
          >
            {props.children}
          </div>
        </div>
      </div>
    </Show>
  )
}
