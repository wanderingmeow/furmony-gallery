import { createEffect, createSignal, For, Match, onCleanup, onMount, Show, Switch } from 'solid-js'
import { onImageError, preloadImage } from '../../data/image'
import { EASE } from '../../draw/anim'
import { ART_PLACEHOLDER, DETAIL_THUMB, DETAIL_THUMB_ROW, SK_FILL } from '../ui/boxes'
import { SkelImg } from '../ui/SkelImg'

export function Gallery(props: {
  images: string[]; index: () => number; setIndex: (i: number) => void; onOpenFull: () => void
}) {
  const count = props.images.length
  const current = () => props.images[Math.min(props.index(), count - 1)]

  // Two layers, so a switch never shows a blank frame: the old picture stays where it is, the
  // next one loads behind it, then fades in and takes its place.
  const [displayed, setDisplayed] = createSignal(current())
  const [incoming, setIncoming] = createSignal<string | null>(null)
  const [ready, setReady] = createSignal(false)
  // the displayed picture fades in when it loads
  const [mainLoaded, setMainLoaded] = createSignal(false)

  // The picture animates its own height. A wrapper around it can only reveal or clip, and it
  // clips: the wrapper reaches the target height before the picture does. Growing with the height
  // is the effect a switch is meant to have.
  // When hPx is 0, the layout decides the height.
  const MAX_H = 400 // Tailwind max-h-100
  const [hPx, setHPx] = createSignal(0)
  let wrapperEl!: HTMLDivElement
  let skeletonH = 0
  const fit = (pic: { naturalWidth: number; naturalHeight: number }): number => {
    const w = wrapperEl ? wrapperEl.clientWidth : 0
    return w > 0 && pic.naturalHeight > 0 ? Math.min(w / (pic.naturalWidth / pic.naturalHeight), MAX_H) : 0
  }

  let cancelPending: (() => void) | null = null
  let targetH = 0
  let settled = false

  // The skeleton stays until the first picture arrives. Later switches do not use it: the
  // crossfade covers them, and a skeleton over a picture that is already cached hides that
  // picture for no reason.
  const [loading, setLoading] = createSignal(count > 0)
  let firstDone = false
  createEffect(() => {
    if (firstDone) return
    const src = current()
    if (!src) { firstDone = true; setLoading(false); return }
    const job = preloadImage(src)
    onCleanup(job.cancel)
    void job.ready.then(() => { firstDone = true; setLoading(false) })
  })

  createEffect(() => {
    const target = current()
    if (target === displayed() || target === incoming()) return
    cancelPending?.()
    setIncoming(target)
    setReady(false)
    const job = preloadImage(target)
    cancelPending = job.cancel
    void job.ready.then((pic) => {
      // A newer switch may have taken over while this download was running.
      if (cancelPending !== job.cancel || current() !== target) return
      // the height the incoming picture needs: full width, contained, capped at MAX_H
      targetH = fit(pic)
      setReady(true)
      cancelPending = null
    })
  })

  // After the incoming picture has faded in it becomes the displayed one, and the overlay goes
  // away. The new picture is drawn at the old height first, then hPx animates to the height it
  // needs, so the switch grows or shrinks.
  createEffect(() => {
    if (!ready()) return
    const t = setTimeout(() => {
      const inc = incoming()
      if (inc) {
        setDisplayed(inc)
        setIncoming(null)
        setReady(false)
        settled = true
        if (targetH > 0) setHPx(targetH)
      }
    }, 220)
    onCleanup(() => clearTimeout(t))
  })

  // Stop a download that is still running when the gallery goes away: it would take bandwidth
  // away from whatever the user opens next.
  onCleanup(() => { cancelPending?.() })

  // The first height this picture paints is the one the skeleton held, so the two states meet
  // without a jump. From then on hPx drives it, and 0 means the layout decides.
  const picHeight = () => (hPx() ? `${hPx()}px` : skeletonH ? `${skeletonH}px` : 'auto')

  return (
    <Switch fallback={<div class={`bg-surface-2 ${ART_PLACEHOLDER}`} />}>
      <Match when={loading()}>
        <GallerySkeleton thumbs={props.images.length} onHeight={(px) => (skeletonH = px)} />
      </Match>
      <Match when={count > 0}>
        <div>
          <div class="relative" ref={wrapperEl}>
            <Show when={displayed()}>
              <img
                src={displayed()}
                alt=""
                class="w-full max-h-100 object-contain rounded-xl bg-surface"
                style={{
                  height: picHeight(),
                  transition: `height 220ms ${EASE}, opacity 300ms`,
                  opacity: mainLoaded() ? 1 : 0,
                }}
                onClick={props.onOpenFull}
                onLoad={(e) => {
                  setMainLoaded(true)
                  if (settled) return
                  settled = true
                  setHPx(fit(e.currentTarget))
                }}
                onError={(e) => { setMainLoaded(true); onImageError(e) }} // a broken picture still fades in
              />
            </Show>
            <Show when={incoming()}>
              <img
                src={incoming()!}
                alt=""
                class="absolute inset-0 w-full h-full object-contain rounded-xl bg-surface transition-opacity"
                style={{ opacity: ready() ? 1 : 0, 'transition-duration': '200ms' }}
                onClick={props.onOpenFull}
                onError={onImageError}
              />
            </Show>
            {/* a switch shows the spinner while the picture decodes; a first picture shows the
                skeleton */}
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
          {/* For keys on the url, so a re-render keeps the thumbnails that are already loaded */}
          <div class={DETAIL_THUMB_ROW}>
            <For each={props.images}>
              {(url, i) => (
                <SelectorThumb url={url} active={i() === props.index()} onSelect={() => props.setIndex(i())} />
              )}
            </For>
          </div>
        </div>
      </Match>
    </Switch>
  )
}

/**
 * The space the gallery takes while the first picture loads. At that point the app already knows
 * how many pictures there are, so the thumbnail strip can sit here too. The height goes back out
 * through onHeight, and the first picture starts at that height, so the two states line up
 * without a jump.
 */
function GallerySkeleton(props: { thumbs: number; onHeight: (px: number) => void }) {
  let bar!: HTMLDivElement
  onMount(() => props.onHeight(bar.offsetHeight))
  return (
    <div>
      <div ref={bar} class={`${SK_FILL} ${ART_PLACEHOLDER}`} />
      <Show when={props.thumbs > 0}>
        <div class={DETAIL_THUMB_ROW}>
          <For each={Array.from({ length: props.thumbs })}>
            {() => <div class={`${SK_FILL} ${DETAIL_THUMB}`} />}
          </For>
        </div>
      </Show>
    </div>
  )
}

// A thumbnail in the strip below the picture; it selects its own picture.
function SelectorThumb(props: { url: string; active: boolean; onSelect: () => void }) {
  return (
    <SkelImg
      url={props.url}
      box={`${DETAIL_THUMB} cursor-pointer border-2`}
      style={{ 'border-color': props.active ? 'var(--color-accent)' : 'transparent' }}
      onClick={props.onSelect}
    />
  )
}
