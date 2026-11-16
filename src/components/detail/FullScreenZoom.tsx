import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { CloseOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons-svg'
import Panzoom from '@panzoom/panzoom'
import { onImageError } from '../../data/image'
import { AntIcon } from '../ui/AntIcon'
import { watchTaps } from '../ui/tapGate'

/** The three controls over the picture share one look: the circle appears when the pointer
 *  arrives and brightens under the finger. Tailwind v4 gives a button the default cursor, so
 *  `ENABLED` sets the hand. `DISABLED` is the flat look for a control at its zoom limit. */
const CONTROL = 'flex items-center justify-center text-white transition-colors backdrop-blur-lg'
const ENABLED = 'cursor-pointer bg-black/40 hover:bg-white/15 active:bg-white/25'
const DISABLED = 'bg-black/20 text-white/40 cursor-not-allowed'

export function FullScreenZoom(props: {
  imageUrl: string; count: number; index: () => number; onClose: () => void
}) {
  let container!: HTMLDivElement
  let img!: HTMLImageElement
  let pz: ReturnType<typeof Panzoom> | null = null
  const [scale, setScale] = createSignal(1)
  const MIN_SCALE = 1
  const MAX_SCALE = 5
  const atMax = () => scale() >= MAX_SCALE - 0.01
  const atMin = () => scale() <= MIN_SCALE + 0.01

  createEffect(() => {
    const url = props.imageUrl
    if (!url) return
    if (pz) { pz.destroy(); pz = null }

    pz = Panzoom(img, { maxScale: MAX_SCALE, minScale: MIN_SCALE, contain: 'outside', cursor: 'grab' })
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      if (pz) {
        pz.zoomWithWheel(e)
        setScale(pz.getScale())
      }
    }
    // panzoom fires `panzoomchange` on every transform, whether the wheel, a button or a pinch
    // caused it, so the zoom buttons always show the real scale.
    const onZoomChange = () => { if (pz) setScale(pz.getScale()) }
    img.addEventListener('panzoomchange', onZoomChange)
    container.addEventListener('wheel', wheel, { passive: false })
    onCleanup(() => {
      img.removeEventListener('panzoomchange', onZoomChange)
      container.removeEventListener('wheel', wheel)
      pz?.destroy()
      pz = null
    })
  })

  // One tap on the picture closes the viewer.
  onCleanup(watchTaps({
    owns: (target) => target === img || target === container,
    onTap: props.onClose,
  }))

  // document-level keys so they work regardless of focus: Esc/X close, +/- zoom
  onMount(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'x' || e.key === 'X') props.onClose()
      else if (e.key === '+' || e.key === '=' || e.key === 'Add') { pz?.zoomIn(); setScale(pz?.getScale() ?? 1) }
      else if (e.key === '-' || e.key === '_' || e.key === 'Subtract') { pz?.zoomOut(); setScale(pz?.getScale() ?? 1) }
    }
    document.addEventListener('keydown', handler)
    onCleanup(() => document.removeEventListener('keydown', handler))
  })

  return (
    <div
      ref={container}
      class="fixed inset-0 z-50 bg-black flex items-center justify-center"
    >
      <img
        ref={img}
        src={props.imageUrl}
        alt=""
        class="w-full h-full object-contain"
        onError={onImageError}
      />

      {/* close */}
      <button
        class={`${CONTROL} ${ENABLED} absolute top-4 left-4 w-11 h-11 rounded-full`}
        onClick={props.onClose}
        aria-label="关闭大图"
        title="关闭大图"
      >
        <AntIcon icon={CloseOutlined} size={22} />
      </button>

      {/* zoom controls — bottom-right; blackened when the zoom limit is reached */}
      <div class="absolute bottom-6 right-6 flex flex-col gap-2">
        <button
          class={`${CONTROL} w-9 h-9 rounded ${atMax() ? DISABLED : ENABLED}`}
          disabled={atMax()}
          aria-label="放大"
          title="放大"
          onClick={() => { pz?.zoomIn(); setScale(pz?.getScale() ?? 1) }}
        >
          <AntIcon icon={ZoomInOutlined} size={20} />
        </button>
        <button
          class={`${CONTROL} w-9 h-9 rounded ${atMin() ? DISABLED : ENABLED}`}
          disabled={atMin()}
          aria-label="缩小"
          title="缩小"
          onClick={() => { pz?.zoomOut(); setScale(pz?.getScale() ?? 1) }}
        >
          <AntIcon icon={ZoomOutOutlined} size={20} />
        </button>
      </div>

      {/* page indicator — centered */}
      <Show when={props.count > 1}>
        <span class="pointer-events-none backdrop-blur-lg absolute bottom-6 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-black/50 text-white text-xs">
          {props.index() + 1} / {props.count}
        </span>
      </Show>
    </div>
  )
}
