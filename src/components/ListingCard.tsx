import { createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { HeartFilled, HeartOutlined } from '@ant-design/icons-svg'
import type { AdoptListing } from '../types'
import {
  colorNames, displayPrice, formatDiscount, formatPrice, isLocked,
  painterAvatar, painterName, raceName,
} from '../domain'
import { THUMB_ASPECT } from '../layout'
import { removeFromWishlist, toggleWishlist, isWishlisted } from '../store'
import { onImageError, stableImageUrl } from '../image'
import { AntIcon } from './AntIcon'


function Avatar(props: { url?: string; alt: string }) {
  let show = true
  return (
    <Show
      when={props.url}
      fallback={<span class="inline-block w-4.5 h-4.5 rounded-full bg-surface-2" />}
    >
      {(url) => (
        <img
          src={url()}
          alt={props.alt}
          loading="eager"
          decoding="async"
          class="w-4.5 h-4.5 rounded-full object-cover bg-surface-2"
          onError={(e) => {
            if (show) { show = false; e.currentTarget.style.display = 'none' }
          }}
        />
      )}
    </Show>
  )
}

function Tags(props: { tags: string[]; width: number }) {
  // estimate visible tags that fit within card width
  const estimate = (): string[] => {
    const available = props.width - 16
    const spacing = 6
    let used = 0
    const out: string[] = []
    for (const t of props.tags) {
      const w = t.length * 12 + 16
      if (used + w + spacing <= available) {
        out.push(t)
        used += w + spacing
      } else break
    }
    return out
  }

  // right-edge fade only when tags genuinely overflow (estimate can be slightly off)
  let el!: HTMLDivElement
  const [overflow, setOverflow] = createSignal(false)
  onMount(() => {
    const check = () => setOverflow(el.scrollWidth > el.clientWidth + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    onCleanup(() => ro.disconnect())
  })
  const mask = () => (overflow() ? 'linear-gradient(to right, black 92%, transparent)' : undefined)

  return (
    <div
      ref={el}
      class="flex items-center gap-1.5 min-w-0 overflow-hidden"
      style={{ '-webkit-mask-image': mask(), 'mask-image': mask() }}
    >
      {estimate().map((t) => (
        <span class="shrink-0 px-2 py-1 rounded-md bg-surface-2 text-[11px] text-ink">{t}</span>
      ))}
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
  const showHeart = () => !locked || wishlisted()
  const discount = formatDiscount(l)
  const tags = [
    ...(raceName(l) ? [raceName(l)!] : []),
    ...colorNames(l),
  ]

  const onHeart = (e: MouseEvent) => {
    e.stopPropagation()
    if (wishlisted()) removeFromWishlist(id)
    else if (!locked) toggleWishlist(l)
  }

  const [thumbLoading, setThumbLoading] = createSignal(true)

  return (
    <div
      class="rounded-xl bg-surface border border-border p-1.5 select-none"
      style={{ width: `${props.width}px`, opacity: locked ? 0.55 : 1 }}
    >
      {/* painter row */}
      <div class="flex items-center gap-1.5 px-2 py-1.5">
        <Avatar url={painterAvatar(l)} alt="画师" />
        <span class="text-[11px] text-muted truncate">{painterName(l) ?? `画师${l.paintersId}`}</span>
      </div>

      {/* thumbnail — spinner while loading */}
      <div class="px-1.5">
        <div class="relative card-img w-full rounded-lg bg-surface overflow-hidden" style={{ 'aspect-ratio': String(THUMB_ASPECT) }}>
          <Show when={thumbLoading()}>
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="spinner w-5 h-5" />
            </div>
          </Show>
          <img
            src={stableImageUrl(l.adoptPicture)}
            alt={l.adoptName ?? '设定'}
            loading="eager"
            decoding="async"
            class="w-full h-full object-cover rounded-lg"
            onLoad={() => setThumbLoading(false)}
            onError={(e) => { setThumbLoading(false); onImageError(e) }}
          />
        </div>
      </div>

      {/* bottom info */}
      <div class="px-2 pt-1.5 pb-1.5 space-y-1">
        <div class="flex items-center gap-1.5">
          <span class="text-sm font-medium truncate">{l.adoptName ?? '未知'}</span>
          <span class="text-[11px] text-faint shrink-0">#{id}</span>
          <button
            class="ml-auto shrink-0 text-lg leading-none"
            style={{ visibility: showHeart() ? 'visible' : 'hidden' }}
            onClick={onHeart}
            aria-label="收藏"
          >
            <span class={wishlisted() ? 'text-red-500' : locked ? 'text-faint' : 'text-ink'}>
              <AntIcon icon={wishlisted() ? HeartFilled : HeartOutlined} />
            </span>
          </button>
        </div>

        <div class="flex items-center gap-1.5">
          <Tags tags={tags} width={props.width} />
          <div class="ml-auto shrink-0 flex items-center gap-1">
            <Show when={discount > 0}>
              {/* 折扣只在桌面端显示，移动端隐藏 */}
              <span class="hidden sm:inline-block px-1 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">
                {discount.toFixed(1)}折
              </span>
            </Show>
            <span class="text-sm font-bold text-orange-600">{formatPrice(displayPrice(l))}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
