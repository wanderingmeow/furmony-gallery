import { createEffect, createSignal, For, on, onCleanup, onMount, Show, type JSX } from 'solid-js'
import './SegmentedControl.css'

/** A getter lets the line follow its own data while the row stays put. */
export type SegmentLine = JSX.Element | (() => JSX.Element)

const line = (v: SegmentLine): JSX.Element =>
  typeof v === 'function' ? (v as () => JSX.Element)() : v

export interface Segment<V extends string> {
  value: V
  label: SegmentLine
}

/**
 * A row of segments with one chosen, in the shape shadcn's segmented control uses: a track, a
 * chip that slides to the chosen one, and a hairline between neighbors that fades away where
 * the chip touches it.
 *
 * The segments are radio inputs in one group, so the arrow keys move the choice. The chip is
 * measured, because a label's width can change when the data arrives.
 */
export function SegmentedControl<V extends string>(props: {
  value: () => V
  onChange: (v: V) => void
  items: Segment<V>[]
  /** Names the group, for a screen reader and for the radio group. */
  label: string
  /** Each segment takes an equal share of the box the row sits in. */
  fill?: boolean
  class?: string
}) {
  let row!: HTMLDivElement
  const seen = new Map<V, HTMLLabelElement>()
  // The chip waits for its first measurement, so it appears already in place.
  const [chip, setChip] = createSignal<{ x: number; w: number } | null>(null)

  const at = () => props.items.findIndex((s) => s.value === props.value())
  // The hairline sits on an item's left edge, so the chip cuts through its own item's line and
  // the next one's.
  const adjacent = (i: number) => i === at() || i === at() + 1

  const measure = () => {
    const el = seen.get(props.value())
    if (el) setChip({ x: el.offsetLeft, w: el.offsetWidth })
  }

  onMount(() => {
    const ro = new ResizeObserver(measure)
    ro.observe(row)
    for (const el of seen.values()) ro.observe(el)
    onCleanup(() => ro.disconnect())
  })
  createEffect(on(() => props.value(), measure))

  return (
    <div
      ref={row}
      role="group"
      aria-label={props.label}
      class={`seg-row ${props.fill ? 'seg-fill' : ''} ${props.class ?? ''}`}
    >
      <Show when={chip()}>
        {(c) => (
          <span
            class="seg-chip"
            style={{ transform: `translateX(${c().x}px)`, width: `${c().w}px` }}
            aria-hidden="true"
          />
        )}
      </Show>
      <For each={props.items}>
        {(s, i) => (
          <label
            ref={(el) => seen.set(s.value, el)}
            class={`seg-item ${i() === 0 ? 'seg-first' : ''}`}
            classList={{ 'seg-adj': adjacent(i()) }}
          >
            <input
              type="radio"
              name={props.label}
              value={s.value}
              checked={props.value() === s.value}
              onChange={() => props.onChange(s.value)}
              class="sr-only"
            />
            <span class="seg-label">{line(s.label)}</span>
          </label>
        )}
      </For>
    </div>
  )
}
