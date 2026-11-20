// One round button in the bottom-right column, with its own panel above it. The panel opens upward
// only: these buttons sit in the corner of the screen, and one that opened downward would fall off
// the edge.
//
// The panel is portalled to <body>. The waterfall sits in a fixed layer, and a second .glass inside
// that layer is clipped by it, so the blur would never paint.
import { createEffect, createSignal, on, onCleanup, Show, type JSX } from 'solid-js'
import { Portal } from 'solid-js/web'
import type { IconDefinition } from '@ant-design/icons-svg/lib/types'
import { AntIcon } from '../ui/AntIcon'
import { FAB_SIZE, FabCircle } from './FabCircle'

// The count sits on the button's edge, on the 45° line to the top-right corner.
const EDGE = (FAB_SIZE / 2) * Math.SQRT1_2

// The centre is pinned rather than the box's corner: `-50%` is the pill's own half-size, so a
// two-digit count grows along the edge instead of sliding off it.
const ON_EDGE: JSX.CSSProperties = {
  left: '50%',
  top: '50%',
  transform: `translate(calc(-50% + ${EDGE}px), calc(-50% - ${EDGE}px))`,
}

// The popup's bottom edge rests POPUP_GAP above the button, and POPUP_AIR stays free above it.
const POPUP_GAP = 8
const POPUP_AIR = 8

/** The box is the chrome and the height the screen allows. The panel inside owns the padding and
 *  the scrolling, so the content reaches the glass edge. */
const POPUP_BOX = `fixed z-40 glass rounded-xl shadow-xl border border-black/10
                   clip-no-scroll flex flex-col`

export function FabMenu(props: {
  label: string
  icon: IconDefinition | (() => IconDefinition)
  /** Replaces the glyph when it returns an element. Returning null falls back to `icon`. */
  face?: () => JSX.Element | null
  /** The number on the corner button. It has to be readable with the panel shut. */
  badge?: () => number
  panelClass?: string
  children?: JSX.Element
}) {
  const [open, setOpen] = createSignal(false)
  const badge = () => props.badge?.() ?? 0

  let wrap!: HTMLDivElement
  let popup!: HTMLDivElement
  const [pos, setPos] = createSignal<{ bottom: number; right: number; roomAbove: number } | null>(null)

  createEffect(on(open, (shown) => {
    if (!shown) { setPos(null); return }
    // Every measurement reads the box again: the column shifts as a whole when 回到顶部 arrives and
    // when it leaves.
    const measure = () => {
      const r = wrap.getBoundingClientRect()
      setPos({
        bottom: window.innerHeight - r.top + POPUP_GAP,
        right: window.innerWidth - r.right,
        roomAbove: r.top - (POPUP_GAP + POPUP_AIR),
      })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    onCleanup(() => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    })
  }))

  // The capture phase, because a card's own click calls stopPropagation and a tap on anything else
  // would never reach the bubble phase.
  createEffect(on(open, (shown) => {
    if (!shown) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrap.contains(t) || popup.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKey)
    onCleanup(() => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKey)
    })
  }))

  return (
    <div class="relative" ref={wrap}>
      <FabCircle
        title={props.label}
        expanded={open()}
        accent={open}
        onClick={() => setOpen((o) => !o)}
      >
        {props.face?.() ?? <AntIcon icon={props.icon} size="1.25em" />}
        <Show when={badge() > 0}>
          {/* The same orange as the fill, so the number and the button mean one thing. The ring
              takes the circle's own colour, so the number stays cut out when the button is orange
              too. */}
          <span style={ON_EDGE}
            class="absolute min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[9px] font-bold
                   flex items-center justify-center border border-surface">
            {badge()}
          </span>
        </Show>
      </FabCircle>

      <Show when={open() && pos()}>
        <Portal>
          <div
            ref={popup}
            class={`${POPUP_BOX} ${props.panelClass ?? ''}`}
            style={{ bottom: `${pos()!.bottom}px`, right: `${pos()!.right}px`,
              'max-height': `${pos()!.roomAbove}px` }}
          >
            {props.children}
          </div>
        </Portal>
      </Show>
    </div>
  )
}
