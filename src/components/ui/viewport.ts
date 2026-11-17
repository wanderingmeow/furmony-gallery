import { type Accessor, createSignal, onCleanup } from 'solid-js'

/**
 * The window's size, kept current. Waterfall and WaterfallSkeleton size their grids from it, and
 * both need the same column count in the same frame.
 */
export function watchViewport(): { viewportW: Accessor<number>; viewportH: Accessor<number> } {
  const [viewportW, setViewportW] = createSignal(document.documentElement.clientWidth)
  const [viewportH, setViewportH] = createSignal(window.innerHeight)
  const onResize = () => {
    setViewportW(document.documentElement.clientWidth)
    setViewportH(window.innerHeight)
  }
  window.addEventListener('resize', onResize)
  onCleanup(() => window.removeEventListener('resize', onResize))
  return { viewportW, viewportH }
}
