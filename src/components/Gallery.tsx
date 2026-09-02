import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { onImageError } from '../image'

export function Gallery(props: {
  images: string[]; index: () => number; setIndex: (i: number) => void; onOpenFull: () => void
}) {
  const count = props.images.length
  const current = () => props.images[Math.min(props.index(), count - 1)]

  // two-layer crossfade: the old image stays visible, the target preloads, then
  // fades in on top before being promoted — no blank flash / flicker on switch
  const [displayed, setDisplayed] = createSignal(current())
  const [incoming, setIncoming] = createSignal<string | null>(null)
  const [ready, setReady] = createSignal(false)

  // explicit main-image height (px) so aspect-ratio changes on thumbnail switch
  // animate smoothly instead of jumping: 0 = auto (first load), then px + transition
  const MAX_H = 400 // Tailwind max-h-100
  const [hPx, setHPx] = createSignal(0)
  let wrapperEl!: HTMLDivElement
  let targetH = 0

  let pendingImg: HTMLImageElement | null = null
  let pendingTarget = ''

  createEffect(() => {
    const target = current()
    if (target === displayed() || target === incoming()) return
    // abort the previous in-flight preload
    if (pendingImg) { pendingImg.src = ''; pendingImg = null }
    pendingTarget = target
    setIncoming(target)
    setReady(false)
    const img = new Image()
    pendingImg = img
    const mark = () => {
      if (pendingImg === img && pendingTarget === target && current() === target) {
        // target height for the incoming image: w-full object-contain capped at MAX_H
        const w = wrapperEl ? wrapperEl.clientWidth : 0
        const aspect = img.naturalWidth / (img.naturalHeight || 1)
        targetH = w > 0 ? Math.min(w / aspect, MAX_H) : 0
        setReady(true)
        pendingImg = null
      }
    }
    img.onload = mark
    img.onerror = mark // show fallback rather than blank
    img.src = target
  })

  // once the incoming has faded in, promote it to displayed and drop the overlay.
  // the new image renders at the OLD height first, then hPx animates to the target
  // height → smooth extend/shrink instead of an instant jump.
  createEffect(() => {
    if (!ready()) return
    const t = setTimeout(() => {
      const inc = incoming()
      if (inc) {
        setDisplayed(inc)
        setIncoming(null)
        setReady(false)
        if (targetH > 0) setHPx(targetH)
      }
    }, 220)
    onCleanup(() => clearTimeout(t))
  })

  // cancel any in-flight preload when the view closes (slow-3G friendly)
  onCleanup(() => {
    if (pendingImg) { pendingImg.src = ''; pendingImg = null }
  })

  return (
    <Show when={count > 0} fallback={<div class="h-72 rounded-xl bg-surface-2" />}>
      <div>
        <div class="relative" ref={wrapperEl}>
          <Show when={displayed()}>
            <img
              src={displayed()}
              alt=""
              class="w-full max-h-100 object-contain rounded-xl bg-surface"
              style={{
                height: hPx() ? `${hPx()}px` : 'auto',
                transition: 'height 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
              onClick={props.onOpenFull}
              onLoad={(e) => { if (hPx() === 0) setHPx(e.currentTarget.offsetHeight) }}
              onError={onImageError}
            />
          </Show>
          <Show when={incoming()}>
            <img
              src={incoming()!}
              alt=""
              class="absolute inset-0 w-full h-full object-contain rounded-xl bg-surface transition-opacity duration-200"
              style={{ opacity: ready() ? 1 : 0 }}
              onClick={props.onOpenFull}
              onError={onImageError}
            />
          </Show>
          {/* spinner while the target preloads */}
          <Show when={incoming() && !ready()}>
            <div class="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-black/40 rounded-xl">
              <div class="spinner w-6 h-6" />
            </div>
          </Show>
        </div>
        <div class="relative h-0">
          <span class="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-0.5 rounded-md bg-black/50 text-white text-[11px]">
            {props.index() + 1} / {count}
          </span>
        </div>
        {/* thumbnail strip — keyed For so thumbnails reconcile by index (not rebuilt) */}
        <div class="flex gap-1.5 justify-center mt-2">
          <For each={props.images}>
            {(url, i) => (
              <SelectorThumb url={url} active={i() === props.index()} onSelect={() => props.setIndex(i())} />
            )}
          </For>
        </div>
      </div>
    </Show>
  )
}

// Selector thumbnail below the gallery — spinner overlay until the image loads
// (same treatment as card thumbnails, so slow-3G doesn't show a blank frame).
function SelectorThumb(props: { url: string; active: boolean; onSelect: () => void }) {
  const [loaded, setLoaded] = createSignal(false)
  let imgEl!: HTMLImageElement
  // already in cache (complete + has natural size) → set loaded synchronously so the
  // spinner doesn't flash on a cached thumb (async onLoad would lag a frame)
  onMount(() => {
    if (imgEl.complete && imgEl.naturalWidth > 0) setLoaded(true)
  })
  return (
    <div
      class="relative w-15 h-15 shrink-0 rounded-md cursor-pointer border-2 overflow-hidden bg-surface-2"
      style={{ 'border-color': props.active ? '#3b82f6' : 'transparent' }}
      onClick={props.onSelect}
    >
      <Show when={!loaded()}>
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="spinner w-4 h-4" />
        </div>
      </Show>
      <img
        ref={imgEl}
        src={props.url}
        alt=""
        loading="eager"
        decoding="async"
        class="w-full h-full object-cover"
        onLoad={() => setLoaded(true)}
        onError={onImageError}
      />
    </div>
  )
}
