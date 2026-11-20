import { type Accessor, createMemo, createSignal, onCleanup } from 'solid-js'
import type { Insets } from '../../draw/layout'

// `env()` becomes a length only once it reaches a property that takes one, so each band is read
// off a box whose own width or height is the --safe-* name the CSS pads with.
let probe: HTMLDivElement | null = null

function readInset(size: 'width' | 'height', name: string): number {
  probe ??= document.createElement('div')
  if (!probe.isConnected) {
    probe.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none'
    document.body.appendChild(probe)
  }
  probe.style[size] = `var(${name})`
  const box = probe.getBoundingClientRect()
  return size === 'width' ? box.width : box.height
}

const readInsets = (): Insets => ({
  top: readInset('height', '--safe-top'),
  right: readInset('width', '--safe-right'),
  bottom: readInset('height', '--safe-bottom'),
  left: readInset('width', '--safe-left'),
})

/** The window's size, the width left inside its bands, and the bands themselves, kept current.
 *
 *  `safe` is a signal rather than a measurement taken where it is used: turning a phone halfway
 *  around moves the island from one side to the other and changes neither size.
 *
 *  Waterfall and WaterfallSkeleton read the same `frameW`, so both paint one column count.
 */
export function watchViewport(): {
  viewportW: Accessor<number>
  viewportH: Accessor<number>
  frameW: Accessor<number>
  safe: Accessor<Insets>
} {
  const [viewportW, setViewportW] = createSignal(document.documentElement.clientWidth)
  const [viewportH, setViewportH] = createSignal(window.innerHeight)
  const [safe, setSafe] = createSignal(readInsets(), {
    equals: (a: Insets, b: Insets) => a.top === b.top && a.right === b.right
      && a.bottom === b.bottom && a.left === b.left,
  })
  const frameW = createMemo(() => viewportW() - safe().left - safe().right)
  const onResize = () => {
    setViewportW(document.documentElement.clientWidth)
    setViewportH(window.innerHeight)
    setSafe(readInsets())
  }
  onResize()
  window.addEventListener('resize', onResize)
  onCleanup(() => window.removeEventListener('resize', onResize))
  return { viewportW, viewportH, frameW, safe }
}
