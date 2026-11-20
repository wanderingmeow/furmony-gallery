import { tr } from '../../i18n'
import { listingName, listingPainterName, wordsPending } from '../../model/translatedText'
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from 'solid-js'
import type { AdoptListing } from '../../model/types'
import {
  colorDisplay, colorNames, formatPrice, isLocked, priceParts, raceDisplay,
} from '../../model/domain'
import { THUMB_ASPECT } from '../../draw/layout'
import { isWishlisted, toggleWishlist } from '../../stores/wishlistStore'
import { priceMode } from '../../stores/displayStore'
import { onImageError, sizedUrl, stableImageUrl } from '../../data/image'
import { LockedIcon } from '../ui/LockedIcon'
import { SkelText } from '../ui/SkelText'
import { useHaptic } from '../ui/useHaptic'
import { WishlistHeart } from '../ui/WishlistHeart'
import {
  CARD_ARTIST, CARD_BASE, CARD_BODY, CARD_COVER, CARD_FOOT, CARD_NAME,
} from '../ui/boxes'

// One row of tags, 18px tall. Chips that do not fit wrap to a second row, which the fixed
// height clips: the reader sees a clean edge instead of a sliver of a chip.
function Tags(props: { tags: string[] }) {
  return (
    <div class="flex flex-wrap items-center gap-1.5 min-w-0 overflow-hidden h-[18px]">
      <For each={props.tags}>
        {/* A chip cannot wrap itself, so the one that is too long for the row would be cut
            mid-word. max-w-full + truncate turns that into an ellipsis, which reads as
            "there is more" instead of "this is broken". */}
        {(t) => <span class="shrink-0 max-w-full px-1.5 h-[18px] leading-[18px] rounded-md bg-surface-2 text-[10px] text-ink truncate">{t}</span>}
      </For>
    </div>
  )
}

export function ListingCard(props: { listing: AdoptListing; width: number; hold?: () => boolean }) {
  const l = props.listing
  const parts = createMemo(() => priceParts(l, priceMode()))
  const id = l.adoptId
  const locked = isLocked(l)
  const wishlisted = createMemo(() => isWishlisted(id))
  // The words on a chip come from the species and color tables, so the row is a memo: a card
  // that stayed the same object across a change of language still has to change its chips.
  const artist = createMemo(() => listingPainterName(l) ?? tr('detail.painterNumbered', l.paintersId))
  const tags = createMemo(() => [
    ...(raceDisplay(l) ? [raceDisplay(l)!] : []),
    ...colorNames(l).map(colorDisplay),
  ])

  // The heart is inside the card's own click target, so the card would open a detail page
  // on the same click.
  const onHeart = (e: MouseEvent) => {
    e.stopPropagation()
    toggleWishlist(l)
  }

  const [loaded, setLoaded] = createSignal(false)

  // The src waits for the next frame: mounting a tab of 209 cards at once took 1-2s,
  // against ~20-50ms for the DOM alone. Each image then fades in as it decodes.
  //
  // hold keeps the address off while the page moves fast. The DOM is built as before, and the
  // picture waits.
  let imgRef!: HTMLImageElement
  createEffect(on(() => props.hold?.(), (held) => {
    if (held) return
    const url = sizedUrl(stableImageUrl(l.adoptPicture), 'card')
    const raf = requestAnimationFrame(() => { if (url) imgRef.src = url })
    onCleanup(() => cancelAnimationFrame(raf))
  }))

  return (
    <div
      class={`${CARD_BASE} select-none`}
      style={{ width: `${props.width}px` }}
    >
      <div class={CARD_ARTIST}>
        {/* The shelf writes this name, so it waits for the answer in the language on screen. */}
        <span class="text-[11px] text-muted truncate">
          {wordsPending() ? <SkelText class="h-3 w-10" /> : artist()}
        </span>
        <span class="ml-auto shrink-0 text-[11px] text-faint">#{id}</span>
      </div>

      <div class={CARD_COVER}>
        <div class="relative card-img w-full rounded-lg bg-surface overflow-hidden" style={{ 'aspect-ratio': String(THUMB_ASPECT) }}>
          <img
            ref={imgRef}
            alt={wordsPending() ? tr('common.listing') : listingName(l) ?? tr('common.listing')}
            loading="eager"
            decoding="async"
            class="w-full h-full object-cover rounded-lg transition-opacity duration-300"
            classList={{ 'opacity-0': !loaded() }}
            onLoad={() => setLoaded(true)}
            onError={(e) => { setLoaded(true); onImageError(e) }}
          />
        </div>
      </div>

      <div class={CARD_BODY}>
        <div class={CARD_NAME}>
          <span class="text-sm font-medium truncate">
            {wordsPending() ? <SkelText class="h-3.5 w-16" /> : listingName(l) ?? tr('common.unknown')}
          </span>
          {/* The group carries ml-auto rather than the lock, because a card with no lock
              still needs something to push the heart to the right edge. */}
          <div class="ml-auto shrink-0 flex items-center gap-1.5">
            <Show when={locked}>
              <LockedIcon size="16px" />
            </Show>
            {/* The button is a flex box: an inline box is as tall as the font's ascent plus
                descent (19.3px at this size), and the glyph sits about 0.6px low inside it. */}
            <button
              // relative: the switch that buzzes spreads over the nearest positioned box, which has
              // to be this button.
              ref={(el) => useHaptic(el, wishlisted)}
              class="relative flex touch-manipulation text-lg leading-none"
              classList={{ 'text-red-500': wishlisted(), 'text-ink': !wishlisted() }}
              onClick={onHeart}
              aria-label={tr('card.wish')}
            >
              <WishlistHeart on={wishlisted()} class="tap-heart" />
            </button>
          </div>
        </div>

        <div class={CARD_FOOT}>
          {/* A card is 191px wide: the price never shrinks, the tags take what is left.
              min-h-5 holds the row at 20px with the price hidden, so a card with no price is
              as tall as a card with one, and the row pitch in draw/layout.ts still holds. */}
          <div class="min-w-0 flex-1">
            <Tags tags={tags()} />
          </div>
          <div class="shrink-0 flex items-center gap-1">
            {/* One number only, and in installment mode that number is 首付: while browsing
                the question is "roughly what does this cost". The monthly amount and the
                total are for the detail page. */}
            <Show when={parts()?.card}>
              {(card) => (
                <span class="inline-flex items-baseline gap-1 text-sm font-bold text-accent-ink tabular-nums">
                  <Show when={card().label}><span>{card().label}</span></Show>
                  <span>{formatPrice(card().value)}</span>
                </span>
              )}
            </Show>
          </div>
        </div>
      </div>
    </div>
  )
}
