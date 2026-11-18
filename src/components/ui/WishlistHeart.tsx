import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js'
import { HeartFilled, HeartOutlined } from '@ant-design/icons-svg'
import { AntIcon } from './AntIcon'

// All six lines stay in the red family. One colour each would look like confetti.
const SPARKS = Array.from({ length: 6 }, (_, i) => ({
  theta: `${(i / 6) * 360}deg`,
  color: ['var(--color-red-400)', 'var(--color-red-500)', 'var(--color-red-600)'][i % 3],
}))

// The ring and the lines run past the heart's own 460ms bounce, so this waits for the longest
// of them.
const HEART_POP_MS = 620

/**
 * The wishlist glyph.
 *
 * The burst plays on the way into the wishlist, and not on the way out. A listing that was
 * already saved when this card mounted has no earlier value to compare with, so a reload stays
 * quiet. The same holds for a listing that the wishlist drops by itself.
 *
 * The card and the detail sheet show the same listing at the same time, so one save changes two
 * copies of this component. The copy whose button you pressed plays; the other one sits behind
 * the sheet, where it would show through on desktop.
 */
export function WishlistHeart(props: {
  on: boolean
  size?: string | number
  class?: string
}) {
  const [pop, setPop] = createSignal(false)
  let host!: HTMLSpanElement
  let timer: ReturnType<typeof setTimeout> | undefined
  let pressed = false

  // A tap often lands on the label beside the heart, so a press anywhere on the whole button
  // counts as this copy being used.
  onMount(() => {
    const control = host.closest('button') ?? host
    const press = () => (pressed = true)
    control.addEventListener('pointerdown', press)
    onCleanup(() => control.removeEventListener('pointerdown', press))
  })

  createEffect(
    on(
      () => props.on,
      (saved, was) => {
        const mine = pressed
        pressed = false
        if (!saved || was !== false || !mine) return
        clearTimeout(timer)
        // The burst lives in the tree for as long as this signal is true, so it has to leave for
        // one frame before it can play a second time.
        setPop(false)
        requestAnimationFrame(() => setPop(true))
        timer = setTimeout(() => setPop(false), HEART_POP_MS)
      },
    ),
  )

  onCleanup(() => clearTimeout(timer))

  return (
    <span ref={host} class={`relative flex ${props.class ?? ''}`}>
      <span classList={{ 'heart-pop': pop() }} class="flex">
        <AntIcon icon={props.on ? HeartFilled : HeartOutlined} size={props.size} />
      </span>
      <Show when={pop()}>
        {/* The burst is measured in em, so the font-size here is the heart's own size. The row
            around it uses 14px, which leaves the lines no room to get out. */}
        <span
          class="heart-burst"
          aria-hidden="true"
          style={{ 'font-size': props.size === undefined ? undefined : `${props.size}px` }}
        >
          <span class="heart-ripple" />
          <For each={SPARKS}>
            {(s) => (
              <span class="heart-spark" style={{ '--theta': s.theta, 'background-color': s.color }} />
            )}
          </For>
        </span>
      </Show>
    </span>
  )
}
