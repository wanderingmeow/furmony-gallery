import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { CloseOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons-svg'
import Panzoom from '@panzoom/panzoom'
import { onImageError } from '../image'
import { AntIcon } from './AntIcon'

export function FullScreenZoom(props: {
  imageUrl: string; count: number; index: () => number; onClose: () => void
}) {
  let container!: HTMLDivElement
  let img!: HTMLImageElement
  let pz: ReturnType<typeof Panzoom> | null = null
  const [scale, setScale] = createSignal(1)
  const atMax = () => scale() >= MAX_SCALE - 0.01
  const atMin = () => scale() <= MIN_SCALE + 0.01

  const MIN_SCALE = 1
  const MAX_SCALE = 5

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
    // sync scale on ANY zoom source (wheel, buttons, pinch, double-tap) — panzoom
    // fires `panzoomchange` on every transform, so the zoom buttons reflect the
    // real current state even when the user zoomed manually.
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
        class="absolute top-4 left-4 w-11 h-11 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/70"
        onClick={props.onClose}
      >
        <AntIcon icon={CloseOutlined} size={22} />
      </button>

      {/* zoom controls — bottom-right; blackened when the zoom limit is reached */}
      <div class="absolute bottom-6 right-6 flex flex-col gap-2">
        <button
          class="w-9 h-9 rounded flex items-center justify-center"
          classList={{ 'bg-black/20 text-white/40 cursor-not-allowed': atMax(), 'bg-black/40 text-white': !atMax() }}
          disabled={atMax()}
          onClick={() => { pz?.zoomIn(); setScale(pz?.getScale() ?? 1) }}
        >
          <AntIcon icon={ZoomInOutlined} size={20} />
        </button>
        <button
          class="w-9 h-9 rounded flex items-center justify-center"
          classList={{ 'bg-black/20 text-white/40 cursor-not-allowed': atMin(), 'bg-black/40 text-white': !atMin() }}
          disabled={atMin()}
          onClick={() => { pz?.zoomOut(); setScale(pz?.getScale() ?? 1) }}
        >
          <AntIcon icon={ZoomOutOutlined} size={20} />
        </button>
      </div>

      {/* page indicator — centered */}
      <Show when={props.count > 1}>
        <span class="absolute bottom-6 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-black/50 text-white text-xs">
          {props.index() + 1} / {props.count}
        </span>
      </Show>
    </div>
  )
}
