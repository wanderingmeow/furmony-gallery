import { tr } from '../../i18n'
import { Show } from 'solid-js'
import { BOX, type Shape } from '../../draw/layout'
import type { AdoptListing } from '../../model/types'
import type { IconDefinition } from '@ant-design/icons-svg/lib/types'
import { isWishlisted, toggleWishlist } from '../../stores/wishlistStore'
import { socials } from '../../stores/socialsStore'
import { XOutlined, BilibiliOutlined, TikTokOutlined, LinkOutlined, ExportOutlined } from '@ant-design/icons-svg'
import { isLocked } from '../../model/domain'
import { PLATFORM_ORDER, buildUrl, displayValue, type PlatformKey } from '../../data/socials'
import { AntIcon } from '../ui/AntIcon'
import { useHaptic } from '../ui/useHaptic'
import { WishlistHeart } from '../ui/WishlistHeart'
import { XiaohongshuIcon } from '../ui/XiaohongshuIcon'

// platform brand meta for the chips: rounded-square icon + brand color + label (outlined
// glyphs). Xiaohongshu uses the custom XiaohongshuIcon component.
// `custom` overrides the ant glyph when set.
type ChipMeta = {
  icon: IconDefinition
  custom?: (props: { size?: number }) => any
  color: string
  /** Read when the chip draws, so the name arrives in the language on screen. */
  label: () => string
}
const PLATFORM_META: Record<PlatformKey, ChipMeta> = {
  x: { icon: XOutlined, color: '#000000', label: () => 'X' },
  bilibili: { icon: BilibiliOutlined, color: '#fb7299', label: () => 'Bilibili' },
  tiktok: { icon: TikTokOutlined, color: '#010101', label: () => 'TikTok' },
  douyin: { icon: TikTokOutlined, color: '#000000', label: () => tr('brand.douyin') },
  xiaohongshu: {
    icon: LinkOutlined, custom: XiaohongshuIcon, color: '#ff2442', label: () => tr('brand.xiaohongshu'),
  },
}

// Social chips (rounded-square icon buttons) for a locked listing's owner. `socials()` starts empty
// and fills in when the runtime fetch resolves, so the chips never block the sheet. Each one opens
// its platform URL in a new tab, and a platform with no URL gets no chip.
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
              aria-label={c.meta.label()}
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

// The bar at the foot of the detail: 收藏 toggle (works for locked listings too) + social chips
// (locked only) + 前往官网.
export function DetailToolbar(props: { item: AdoptListing; shape: Shape }) {
  const wishlisted = () => isWishlisted(props.item.adoptId)
  return (
    <div class={`border-t border-border bg-canvas pt-3 ${BOX[props.shape].barPad}`}>
      <div class="flex items-center gap-4">
        <button
          // relative: the switch that buzzes spreads over the nearest positioned box, which has to
          // be this button.
          ref={(el) => useHaptic(el, wishlisted)}
          class="relative flex touch-manipulation items-center gap-1.5 h-9 px-3 rounded-lg text-sm"
          classList={{
            'bg-red-500/15 text-red-600 dark:bg-red-500/25': wishlisted(),
            'bg-surface text-ink': !wishlisted(),
          }}
          onClick={() => toggleWishlist(props.item)}
        >
          <WishlistHeart
            on={wishlisted()}
            size={18}
            class={wishlisted() ? 'text-red-500' : 'text-muted'}
          />
          <span>{wishlisted() ? tr('card.wished') : tr('card.wish')}</span>
        </button>
        <Show when={isLocked(props.item)}>
          <SocialChips item={props.item} />
        </Show>
        <div class="flex-1" />
        <a
          href={`https://www.furmony.com/product/detail?id=${props.item.adoptId}&type=LYWT`}
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent text-white text-sm font-semibold"
        >
          {tr('detail.goOfficial')}
          <AntIcon icon={ExportOutlined} size={14} />
        </a>
      </div>
    </div>
  )
}
