import { createEffect, createSignal, For, Match, on, onCleanup, onMount, Show, Switch, untrack } from 'solid-js'
import { onImageError, preloadImage, imageReady } from '../../data/image'
import { EASE } from '../../draw/anim'
import { ART_PLACEHOLDER, DETAIL_THUMB, DETAIL_THUMB_ROW, SK_FILL } from '../ui/boxes'
import { SkelImg } from '../ui/SkelImg'

export function Gallery(props: {
  images: string[]
  index: () => number
  setIndex: (i: number) => void
  onOpenFull: () => void
  /** The tallest picture this may take. Detail passes what the screen leaves; DEFAULT_MAX_H is the
   *  ceiling for a caller that does not. */
  maxH?: number
  /** The exact box the picture fills, centered in it. Wins over maxH. */
  fillH?: number
}) {
  const count = props.images.length
  const current = () => props.images[Math.min(props.index(), count - 1)]

  // A picture already in memory has a known height at the first layout, so the skeleton, the
  // grow, and the fade have no wait to cover. These two reads are for the first picture only, so
  // `untrack` keeps them from subscribing: the layers below follow the index.
  const readyNow = untrack(() => !!current() && imageReady(current()))

  // Two layers, so a switch never shows a blank frame: the old picture stays where it is, the
  // next one loads behind it, then fades in and takes its place.
  const [displayed, setDisplayed] = createSignal(untrack(current))
  const [incoming, setIncoming] = createSignal<string | null>(null)
  const [ready, setReady] = createSignal(false)
  // the displayed picture fades in when it loads
  const [mainLoaded, setMainLoaded] = createSignal(readyNow)

  // The ceiling a caller may raise or lower with maxH.
  const DEFAULT_MAX_H = 400
  const cap = () => props.maxH ?? DEFAULT_MAX_H
  const fill = () => props.fillH
  // The height the picture animates to. 0 leaves it to the layout.
  const [hPx, setHPx] = createSignal(0)
  let wrapperEl!: HTMLDivElement
  let picEl!: HTMLImageElement
  let skeletonH = 0
  const fit = (pic: { naturalWidth: number; naturalHeight: number }): number => {
    const w = wrapperEl ? wrapperEl.clientWidth : 0
    return w > 0 && pic.naturalHeight > 0 ? Math.min(w / (pic.naturalWidth / pic.naturalHeight), cap()) : 0
  }

  let cancelPending: (() => void) | null = null
  let targetH = 0

  // A transition has no start value while the height is auto, so one frame later that height
  // becomes a number of pixels.
  if (readyNow) {
    onMount(() => {
      requestAnimationFrame(() => {
        const h = picEl ? picEl.getBoundingClientRect().height : 0
        if (h > 0) setHPx(h)
      })
    })
  }

  // The skeleton stays until the first picture arrives. Later switches do not use it: the
  // crossfade covers them, and a skeleton over a picture that is already cached hides that
  // picture for no reason.
  const [loading, setLoading] = createSignal(count > 0 && !readyNow)
  let firstDone = readyNow
  let settled = readyNow
  createEffect(on(current, (src) => {
    if (firstDone) return
    if (!src) { firstDone = true; setLoading(false); return }
    const job = preloadImage(src)
    onCleanup(job.cancel)
    void job.ready.then(() => { firstDone = true; setLoading(false) })
  }))

  createEffect(on([current, displayed, incoming], () => {
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
      // the height the incoming picture needs: full width, contained, capped by maxH
      targetH = fit(pic)
      setReady(true)
      cancelPending = null
    })
  }))

  // After the incoming picture has faded in it becomes the displayed one, and the overlay goes
  // away. The new picture is drawn at the old height first, then hPx animates to the height it
  // needs, so the switch grows or shrinks.
  createEffect(on(ready, (isReady) => {
    if (!isReady) return
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
  }))

  // Stop a download that is still running when the gallery goes away: it would take bandwidth
  // away from whatever the user opens next.
  onCleanup(() => { cancelPending?.() })

  // The first height this picture paints is the one the skeleton held, so the two states meet
  // without a jump. From then on hPx drives it, and 0 means the layout decides.
  const picHeight = () => (hPx() ? `${hPx()}px` : skeletonH ? `${skeletonH}px` : 'auto')

  // A panel hands over an exact box to fill; otherwise the picture's own height animates, and cap()
  // keeps it from running past the first screen. That height sits on the picture, not on a wrapper:
  // a wrapper could only reveal or clip, and a clip shows the wrapper reaching the target before the
  // picture does.
  const wrapperBox = () => (fill() ? { height: `${fill()}px` } : undefined)
  const picBox = () =>
    fill() ? { height: '100%' } : { height: picHeight(), 'max-height': `${cap()}px` }

  // hPx holds pixels that one width produced, so a new width has to redo it: a phone turned back
  // upright would otherwise keep the height the picture fitted at sideways.
  let sizes: ResizeObserver | undefined
  const watchWidth = (el: HTMLDivElement) => {
    wrapperEl = el
    if (typeof ResizeObserver === 'undefined') return
    sizes ??= new ResizeObserver(() => {
      if (!settled || fill() || !picEl) return
      const h = fit(picEl)
      if (h > 0) setHPx(h)
    })
    sizes.observe(el)
  }
  onCleanup(() => sizes?.disconnect())

  return (
    <Switch fallback={<div class={`bg-surface-2 ${ART_PLACEHOLDER}`} />}>
      <Match when={loading()}>
        <GallerySkeleton thumbs={props.images.length} maxH={cap()} fillH={fill()} onHeight={(px) => (skeletonH = px)} />
      </Match>
      <Match when={count > 0}>
        <div>
          <div class="relative" ref={watchWidth} style={wrapperBox()}>
            <Show when={displayed()}>
              <img
                src={displayed()}
                alt=""
                ref={picEl}
                class="w-full object-contain rounded-xl bg-surface"
                style={{
                  ...picBox(),
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

/** The space the gallery takes while the first picture loads. The list already says how many
 *  pictures there are, so the thumbnail strip sits here too, and the height goes back out through
 *  onHeight so the first picture starts at it. */
function GallerySkeleton(props: { thumbs: number; maxH: number; fillH?: number; onHeight: (px: number) => void }) {
  let bar!: HTMLDivElement
  onMount(() => props.onHeight(bar.offsetHeight))
  return (
    <div>
      <div
        ref={bar}
        class={`${SK_FILL} ${ART_PLACEHOLDER}`}
        style={props.fillH ? { height: `${props.fillH}px` } : { 'max-height': `${props.maxH}px` }}
      />
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
