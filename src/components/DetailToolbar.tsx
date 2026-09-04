import { Show } from 'solid-js'
import type { AdoptListing } from '../types'
import type { IconDefinition } from '@ant-design/icons-svg/lib/types'
import { isWishlisted, toggleWishlist, removeFromWishlist, socials } from '../store'
import { HeartFilled, HeartOutlined, XOutlined, BilibiliOutlined, TikTokOutlined, LinkOutlined, ExportOutlined } from '@ant-design/icons-svg'
import { isLocked } from '../domain'
import { PLATFORM_ORDER, buildUrl, displayValue, type PlatformKey } from '../socials'
import { AntIcon } from './AntIcon'
import { XiaohongshuIcon } from './XiaohongshuIcon'

// platform brand meta for the chips: rounded-square icon + brand color + label (outlined
// glyphs). Xiaohongshu uses the custom XiaohongshuIcon component.
// `custom` overrides the ant glyph when set.
type ChipMeta = { icon: IconDefinition; custom?: (props: { size?: number }) => any; color: string; label: string }
const PLATFORM_META: Record<PlatformKey, ChipMeta> = {
  x: { icon: XOutlined, color: '#000000', label: 'X' },
  bilibili: { icon: BilibiliOutlined, color: '#fb7299', label: 'Bilibili' },
  tiktok: { icon: TikTokOutlined, color: '#010101', label: 'TikTok' },
  douyin: { icon: TikTokOutlined, color: '#000000', label: '抖音' },
  xiaohongshu: { icon: LinkOutlined, custom: XiaohongshuIcon, color: '#ff2442', label: '小红书' },
}

// Social chips (rounded-square icon buttons) for a locked setting's owner. Reactive on
// `socials()` — starts empty and rehydrates when the runtime fetch resolves, so it never
// blocks the sheet. Opens each platform URL in a new tab; no URL → chip omitted.
function SocialChips(props: { item: AdoptListing }) {
  const chips = () => {
    const p = socials().get(props.item.adoptId)?.platforms
    if (!p) return []
    return PLATFORM_ORDER.flatMap((key) => {
      if (p[key] == null) return []
      const url = buildUrl(key, p)
      if (!url) return [] // no URL → don't show the chip
      return [{ url, value: displayValue(key, p), meta: PLATFORM_META[key] }]
    })
  }
  return (
    <Show when={chips().length > 0}>
      <div class="flex items-center gap-2">
        {chips().map((c) => {
          const Custom = c.meta.custom
          return (
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              title={c.value}
              aria-label={c.meta.label}
              class="inline-flex items-center justify-center w-9 h-9 rounded-md text-white"
              style={{ background: c.meta.color }}
            >
              {Custom ? <Custom size={18} /> : <AntIcon icon={c.meta.icon} size={18} />}
            </a>
          )
        })}
      </div>
    </Show>
  )
}

// Sticky bottom toolbar for the detail sheet: 收藏 toggle (works for locked settings too) +
// social chips (locked only) + 前往官网.
export function DetailToolbar(props: { item: AdoptListing }) {
  const wishlisted = () => isWishlisted(props.item.adoptId)
  return (
    <div class="sticky bottom-0 border-t border-border bg-canvas px-4 py-3">
      <div class="flex items-center gap-4">
        <button
          class="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm"
          classList={{ 'bg-red-500/15 text-red-600': wishlisted(), 'bg-surface text-ink': !wishlisted() }}
          onClick={() => {
            if (wishlisted()) removeFromWishlist(props.item.adoptId)
            else toggleWishlist(props.item)
          }}
        >
          <span class={wishlisted() ? 'text-red-500' : 'text-muted'}>
            <AntIcon icon={wishlisted() ? HeartFilled : HeartOutlined} size={18} />
          </span>
          <span>{wishlisted() ? '已收藏' : '收藏'}</span>
        </button>
        <Show when={isLocked(props.item)}>
          <SocialChips item={props.item} />
        </Show>
        <div class="flex-1" />
        <a
          href={`https://www.furmony.com/product/detail?id=${props.item.adoptId}&type=LYWT`}
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold"
        >
          前往官网
          <AntIcon icon={ExportOutlined} size={14} />
        </a>
      </div>
    </div>
  )
}
