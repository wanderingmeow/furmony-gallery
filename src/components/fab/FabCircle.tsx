// The circle that the floating corner controls share. Every one of them takes the same size,
// centering and border; a caller picks the fill and the shadow.
import type { JSX } from 'solid-js'

/** Must match the `w-12 h-12` below. A caller that places something against the edge needs the
 *  number, and it cannot read a class string. */
export const FAB_SIZE = 48

export function FabCircle(props: {
  title: string
  /** set while the control's own panel is open */
  expanded?: boolean
  /** the orange fill, for the entry a column leads with */
  accent?: boolean | (() => boolean)
  /** the orange shadow that goes with that fill */
  glow?: boolean
  class?: string
  style?: JSX.CSSProperties
  onClick?: () => void
  children?: JSX.Element
}) {
  const accent = () => (typeof props.accent === 'function' ? props.accent() : props.accent === true)
  return (
    <button
      class={`fab-circle press-fab relative cursor-pointer w-12 h-12 rounded-full flex items-center justify-center text-xl border${
        props.glow ? ' fab-glow' : ''}${props.class ? ` ${props.class}` : ''}`}
      classList={{
        'bg-accent text-white border-accent-ink/40': accent(),
        'chrome-glass text-ink border-border': !accent(),
      }}
      style={props.style}
      title={props.title}
      aria-label={props.title}
      aria-expanded={props.expanded}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}
