import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { HeartFilled, HeartOutlined } from '@ant-design/icons-svg'
import type { AdoptListing } from '../types'
import {
  colorNames, displayPrice, formatPrice, isLocked,
  painterName, raceName,
} from '../domain'
import { THUMB_ASPECT } from '../layout'
import { removeFromWishlist, toggleWishlist, isWishlisted } from '../store'
import { onImageError, stableImageUrl } from '../image'
import { AntIcon } from './AntIcon'

function Tags(props: { tags: string[] }) {
  // Pure CSS: flex-wrap sends non-fitting tags to a 2nd row, clipped by the one-row-tall
  // overflow-hidden box → fully hidden, no sliver. Fixed chip height = deterministic row.
  return (
    <div class="flex flex-wrap items-center gap-1.5 min-w-0 overflow-hidden h-[18px]">
      <For each={props.tags}>
        {(t) => <span class="shrink-0 px-1.5 h-[18px] leading-[18px] rounded-md bg-surface-2 text-[10px] text-ink">{t}</span>}
      </For>
    </div>
  )
}

export function ListingCard(props: { listing: AdoptListing; width: number }) {
  const l = props.listing
  const id = l.adoptId
  const locked = isLocked(l)
  // reactive: isWishlisted reads the wishlist() signal, so the card's heart updates
  // the moment you favorite/unfavorite (no need to wait for a re-render on scroll)
  const wishlisted = createMemo(() => isWishlisted(id))
  const tags = [
    ...(raceName(l) ? [raceName(l)!] : []),
    ...colorNames(l),
  ]

  const onHeart = (e: MouseEvent) => {
    e.stopPropagation()
    if (wishlisted()) {
      removeFromWishlist(id)
    } else {
      toggleWishlist(l)
    }
  }

  // Hidden until decoded, then fades in (quiet per-card reveal); aspect-ratio box keeps
  // layout stable.
  const [loaded, setLoaded] = createSignal(false)

  // Defer img.src to the next frame: mounting a tab must not kick all loads/decodes
  // synchronously (209-card switch ~1-2s → ~20-50ms DOM-only); images then fade in
  // in the background.
  let imgRef!: HTMLImageElement
  let raf = 0
  onMount(() => {
    raf = requestAnimationFrame(() => { imgRef.src = stableImageUrl(l.adoptPicture) ?? '' })
    onCleanup(() => { if (raf) cancelAnimationFrame(raf) })
  })

  return (
    <div
      class="rounded-xl bg-surface border border-border p-1.5 select-none"
      style={{ width: `${props.width}px` }}
    >
      <div class="flex items-center gap-1.5 px-2 py-1.5">
        <span class="text-[11px] text-muted truncate">{painterName(l) ?? `画师${l.paintersId}`}</span>
        <span class="ml-auto shrink-0 text-[11px] text-faint">#{id}</span>
      </div>

      {/* thumbnail — hidden until decoded, then fades in */}
      <div class="px-1.5">
        <div class="relative card-img w-full rounded-lg bg-surface overflow-hidden" style={{ 'aspect-ratio': String(THUMB_ASPECT) }}>
          <img
            ref={imgRef}
            // src set lazily in onMount → next frame (see above)
            alt={l.adoptName ?? '设定'}
            loading="eager"
            decoding="async"
            class="w-full h-full object-cover rounded-lg transition-opacity duration-300"
            classList={{ 'opacity-0': !loaded() }}
            onLoad={() => setLoaded(true)}
            onError={(e) => { setLoaded(true); onImageError(e) }}
          />
        </div>
      </div>

      {/* bottom info */}
      <div class="px-2 pt-1.5 pb-1.5 space-y-1">
        <div class="flex items-center gap-1.5">
          <span class="text-sm font-medium truncate">{l.adoptName ?? '未知'}</span>
          <button
            class="ml-auto shrink-0 text-lg leading-none"
            onClick={onHeart}
            aria-label="收藏"
          >
            <span class={wishlisted() ? 'text-red-500' : 'text-ink'}>
              <AntIcon icon={wishlisted() ? HeartFilled : HeartOutlined} />
            </span>
          </button>
        </div>

        <div class="flex items-center gap-1.5">
          <Tags tags={tags} />
          <div class="ml-auto shrink-0 flex items-center gap-1">
            <Show when={locked}>
              <span class="px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px]">已锁定</span>
            </Show>
            <span class="text-sm font-bold text-orange-600">{formatPrice(displayPrice(l))}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
