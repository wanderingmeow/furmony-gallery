import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { useParams } from '@solidjs/router'
import { listings, isWishlisted, toggleWishlist, removeFromWishlist, isLoading, dataReady } from '../store'
import { HeartFilled, HeartOutlined } from '@ant-design/icons-svg'
import { detailImages, isLocked } from '../utils'
import { stableImageUrl } from '../cache'
import { AntIcon } from '../components/AntIcon'
import { Gallery } from '../components/Gallery'
import { FullScreenZoom } from '../components/FullScreenZoom'
import { InfoTable } from '../components/InfoTable'

export function Detail(props: { onClose: () => void }) {
  const params = useParams()
  const listing = createMemo(() => listings().find((l) => l.adoptId === Number(params.id)))

  const [index, setIndex] = createSignal(0)
  const [full, setFull] = createSignal(false)

  // document.title follows the router: home stays "Furmony Gallery", a detail
  // sheet shows "#ID NAME - Furmony Gallery". Reset on close/unmount.
  createEffect(() => {
    const l = listing()
    if (l) document.title = `#${l.adoptId} ${l.adoptName ?? ''} - Furmony Gallery`
  })
  onCleanup(() => { document.title = 'Furmony Gallery' })

  const images = createMemo(() => listing() ? detailImages(listing()!) : [])
  const current = () => {
    const imgs = images()
    const i = Math.min(index(), Math.max(0, imgs.length - 1))
    return imgs.length > 0 ? imgs[i] : stableImageUrl(listing()?.adoptHeadPicture)
  }

  const wishlisted = () => listing() ? isWishlisted(listing()!.adoptId) : false

  // Esc closes the detail sheet. When the fullscreen zoom is open it owns Esc
  // (closes zoom) — detail defers so a single Esc never closes both at once.
  onMount(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !full()) props.onClose()
    }
    document.addEventListener('keydown', handler)
    onCleanup(() => document.removeEventListener('keydown', handler))
  })

  // image preload gate: reveal the gallery only once the FIRST image is loaded.
  // Switching thumbnails must NOT re-gate — the Gallery already crossfades each
  // switch on its own, so resetting ready() here would hide the whole gallery and
  // spin again on every index change even for cached images.
  const [ready, setReady] = createSignal(false)
  let firstLoadDone = false
  createEffect(() => {
    if (firstLoadDone) return
    const src = current()
    if (!src) { setReady(true); firstLoadDone = true; return }
    setReady(false)
    const img = new Image()
    img.onload = () => { setReady(true); firstLoadDone = true }
    img.onerror = () => { setReady(true); firstLoadDone = true } // never block: show fallback
    img.src = src
  })

  return (
    <div class="h-full w-full bg-surface flex flex-col">
      <button
        class="absolute top-3 left-3 z-20 w-11 h-11 rounded-full glass shadow flex items-center justify-center text-xl border border-black/10"
        onClick={props.onClose}
        aria-label="关闭"
        title="关闭"
      >
        ✕
      </button>

      {/* data-detail-scroll: the drag-to-dismiss gesture reads scrollTop here and only
           engages when the content is at its top (so it never mixes with content scroll) */}
      <div data-detail-scroll class="flex-1 min-h-0 overflow-y-auto px-4 pt-16 pb-4">
        <Show
          when={listing()}
          fallback={
            <div class="py-20 text-center text-muted">
              {/* deep-link: data not loaded yet (cache read or fetch in flight) → loading;
                  only after dataReady do we know the id truly doesn't exist → not found */}
              {(!dataReady() || isLoading()) ? '加载中…' : '未找到该设定'}
            </div>
          }
        >
          {(l) => {
            const item = l()
            return (
              <>
                <Show when={ready()} fallback={<ImageLoading />}>
                  <Gallery
                    images={images()}
                    index={index}
                    setIndex={setIndex}
                    onOpenFull={() => setFull(true)}
                  />
                </Show>
                <div class="mt-4">
                  <InfoTable listing={item} />
                </div>
              </>
            )
          }}
        </Show>
      </div>

      {/* bottom toolbar: 前往官网 + wishlist button */}
      <div class="border-t border-border bg-surface px-4 py-3">
        <div class="flex items-center gap-4">
          <Show when={listing()}>
            {(l) => {
              const item = l()
              const locked = isLocked(item)
              const showHeart = !locked || wishlisted()
              return (
                <>
                  <button
                    class="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm"
                    classList={{ 'bg-red-500/15 text-red-600': wishlisted(), 'bg-surface-2 text-ink': !wishlisted() }}
                    style={{ visibility: showHeart ? 'visible' : 'hidden' }}
                    onClick={() => {
                      if (wishlisted()) removeFromWishlist(item.adoptId)
                      else toggleWishlist(item)
                    }}
                  >
                    <span class={wishlisted() ? 'text-red-500' : 'text-muted'}>
                      <AntIcon icon={wishlisted() ? HeartFilled : HeartOutlined} size={18} />
                    </span>
                    <span>{wishlisted() ? '已收藏' : '收藏'}</span>
                  </button>
                  <div class="flex-1" />
                  <a
                    href={`https://www.furmony.com/product/detail?id=${item.adoptId}&type=LYWT`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold"
                  >
                    前往官网 ↗
                  </a>
                </>
              )
            }}
          </Show>
        </div>
      </div>

      {/* fullscreen zoom — rendered to body so it escapes the sheet's overflow/transform */}
      <Show when={full()}>
        <Portal>
          <FullScreenZoom
            imageUrl={current() ?? ''}
            count={Math.max(images().length, listing()?.adoptHeadPicture ? 1 : 0)}
            index={index}
            onClose={() => setFull(false)}
          />
        </Portal>
      </Show>
    </div>
  )
}

// iOS-style centered loading spinner while the detail image preloads
function ImageLoading() {
  return (
    <div class="h-72 rounded-xl bg-surface-2 flex items-center justify-center">
      <div class="w-6 h-6 rounded-full border-[3px] border-transparent border-t-blue-500 animate-spin" />
    </div>
  )
}
