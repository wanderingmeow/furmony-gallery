import { createEffect, createSignal, on, onCleanup, onMount, untrack } from 'solid-js'
import type { IconDefinition } from '@ant-design/icons-svg/lib/types'
import { AntIcon } from './AntIcon'

/**
 * The four-point sparkle that stands for the enhanced search. The installed
 * @ant-design/icons-svg has no sparkle, so we draw the glyph here and pass it to AntIcon like
 * any other. One flat color, so it stays clear of any existing brand mark.
 */
export const SPARK: IconDefinition = {
  name: 'spark',
  theme: 'filled',
  icon: {
    tag: 'svg',
    attrs: { viewBox: '0 0 24 24' },
    children: [
      {
        tag: 'path',
        attrs: {
          d: 'M12 2C12.9 8.1 15.9 11.1 22 12 15.9 12.9 12.9 15.9 12 22 11.1 15.9 8.1 12.9 2 12 8.1 11.1 11.1 8.1 12 2Z',
        },
      },
    ],
  },
}

// The class stays private to this file, so it can only land on the wrapper span. On legacy
// WebKit the same animation on the <svg> itself has no effect, even with getAnimations()
// listing it.
const WORKING = 'spark-pulse'

/**
 * The sparkle, in a wrapper that can carry the working pulse.
 *
 * `icon` covers the search box, where one slot holds the magnifier until the enhanced search is
 * on.
 *
 * A pulse that has ended waits for the end of the cycle. Stopping in the middle leaves the mark
 * at whatever brightness it had reached.
 */
export function SparkMark(props: {
  icon?: () => IconDefinition
  size?: string | number
  working?: boolean | (() => boolean)
  class?: string
}) {
  const wanted = (): boolean =>
    typeof props.working === 'function' ? props.working() : props.working !== false
  const [pulsing, setPulsing] = createSignal(untrack(wanted))
  createEffect(on(wanted, (go) => { if (go) setPulsing(true) }))
  let wrap!: HTMLSpanElement
  const endCycle = () => {
    if (!wanted()) setPulsing(false)
  }
  onMount(() => wrap.addEventListener('animationiteration', endCycle))
  onCleanup(() => wrap.removeEventListener('animationiteration', endCycle))
  return (
    <span ref={wrap} class={`flex items-center ${pulsing() ? WORKING : ''} ${props.class ?? ''}`}>
      <AntIcon icon={props.icon?.() ?? SPARK} size={props.size} />
    </span>
  )
}
