import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { useParams, useNavigate } from '@solidjs/router'
import { ArrowLeftOutlined, CloseOutlined } from '@ant-design/icons-svg'
import {
  listings, isLoading, dataReady, canGoBack, clearDetailHistory, onDetailShow, popBack,
} from '../store'
import { detailImages } from '../model/domain'
import { DETAIL_PAD_X } from '../draw/layout'
import { stableImageUrl } from '../data/image'
import { AntIcon } from '../components/ui/AntIcon'
import { AnimatedHeight } from '../components/ui/AnimatedHeight'
import { SheetFab } from '../components/ui/SheetFab'
import { Gallery } from '../components/detail/Gallery'
import { FullScreenZoom } from '../components/detail/FullScreenZoom'
import { InfoTable } from '../components/detail/InfoTable'
import { RelatedRow } from '../components/detail/RelatedRow'
import { scrollSheetToTop } from '../components/sheet/Sheet'

export function Detail(props: { onClose: () => void }) {
  const params = useParams()
  const navigate = useNavigate()
  const listing = createMemo(() => listings().find((l) => l.adoptId === Number(params.id)))

  const [index, setIndex] = createSignal(0)
  const [full, setFull] = createSignal(false)

  createEffect(() => {
    params.id
    // Which trail this hop belongs to (related row, ←, or a new one from the grid) is
    // the store's question: see stores/detailHistory.
    if (params.id) onDetailShow(params.id)
    setIndex(0) // how far the old setting was paged through says nothing about this one
    // A related tap navigates detail → detail and leaves this component mounted, so
    // without this the reader stays where the old setting left them. The scroll is
    // animated: the new cover should arrive as travel, not as a cut.
    scrollSheetToTop()
  })

  const close = () => {
    clearDetailHistory() // closing ends the trail
    props.onClose()
  }

  const goBack = () => {
    const to = popBack()
    if (!to) return
    navigate(`/detail/${to}`, { replace: true, scroll: false })
  }

  // The title follows the sheet: a detail reads "#ID NAME - Furmony Gallery".
  createEffect(() => {
    const l = listing()
    if (l) document.title = `#${l.adoptId} ${l.adoptName ?? ''} - Furmony Gallery`
  })
  onCleanup(() => { document.title = 'Furmony Gallery' })

  const images = createMemo(() => {
    const l = listing()
    return l ? detailImages(l) : []
  })
  const current = () => {
    const imgs = images()
    const i = Math.min(index(), Math.max(0, imgs.length - 1))
    return imgs.length > 0 ? imgs[i] : stableImageUrl(listing()?.adoptHeadPicture)
  }
  // A setting without detail pictures shows its head picture, so the zoom counter
  // starts at 1 there instead of 0.
  const zoomCount = () => images().length || (listing()?.adoptHeadPicture ? 1 : 0)

  // Esc closes the sheet. While the zoom is open it takes Esc, so a single press
  // closes one layer instead of both.
  onMount(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !full()) close()
    }
    document.addEventListener('keydown', handler)
    onCleanup(() => document.removeEventListener('keydown', handler))
  })

  // Wait for the first image before showing the gallery. Later index changes do not
  // re-gate: the Gallery fades each swap itself, and gating again would hide the whole
  // gallery behind a spinner even for a cached image.
  const [ready, setReady] = createSignal(false)
  let firstLoadDone = false
  createEffect(() => {
    if (firstLoadDone) return
    const src = current()
    if (!src) { setReady(true); firstLoadDone = true; return }
    setReady(false)
    const img = new Image()
    img.onload = () => { setReady(true); firstLoadDone = true }
    img.onerror = () => { setReady(true); firstLoadDone = true } // a broken image still shows
    img.src = src
  })

  return (
    <div class="min-h-full w-full bg-canvas flex flex-col">
      {/* Detail has no header bar: these float over content that spans the sheet and
          scrolls under them. ✕ always closes to the grid. The ← appears only after a
          related tap, and covers "the one I just looked at" — pressing ← never turns ✕
          into a back action. */}
      <div class="absolute top-4 left-4 z-20 flex items-center gap-2">
        <SheetFab label="关闭" onClick={close}>
          <AntIcon icon={CloseOutlined} size={22} />
        </SheetFab>
        <Show when={canGoBack()}>
          <SheetFab label="返回上一个设定" onClick={goBack}>
            <AntIcon icon={ArrowLeftOutlined} size={20} />
          </SheetFab>
        </Show>
      </div>

      {/* pt-16 keeps the first row clear of the floating buttons */}
      <div class="flex-1 min-h-0 pt-16 pb-4" style={{ 'padding-left': `${DETAIL_PAD_X}px`, 'padding-right': `${DETAIL_PAD_X}px` }}>
        <Show
          when={listing()}
          fallback={
            <div class="py-20 text-center text-muted">
              {/* A deep link is not a missing id until the data has had its chance:
                  loading while the cache read or fetch is still running. */}
              {(!dataReady() || isLoading()) ? '加载中…' : '未找到该设定'}
            </div>
          }
        >
          {(l) => (
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
                {/* l() is an accessor: read it inline. Copying it into a const freezes
                    the table on the first setting. */}
                <AnimatedHeight>
                  <InfoTable listing={l()} />
                </AnimatedHeight>
              </div>
              <RelatedRow item={l()} />
            </>
          )}
        </Show>
      </div>

      {/* The zoom goes to the body, so the sheet's overflow and transform cannot clip it */}
      <Show when={full()}>
        <Portal>
          <FullScreenZoom
            imageUrl={current() ?? ''}
            count={zoomCount()}
            index={index}
            onClose={() => setFull(false)}
          />
        </Portal>
      </Show>
    </div>
  )
}

/** The round buttons at the top left: same size, glass, and shadow. */
/** iOS-style spinner in the gallery's place while the first image loads. */
function ImageLoading() {
  return (
    <div class="h-72 rounded-xl bg-surface-2 flex items-center justify-center">
      <div class="w-6 h-6 rounded-full border-[3px] border-transparent border-t-blue-500 animate-spin" />
    </div>
  )
}
