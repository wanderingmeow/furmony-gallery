import { createMemo } from 'solid-js'
import {
  GAP, THUMB_ASPECT, VIEW_PAD, skeletonRows, waterfallCardWidth, waterfallCols, waterfallRowHeight,
} from '../../draw/layout'
import { CARD_ARTIST, CARD_BASE, CARD_BODY, CARD_COVER, CARD_FOOT, CARD_NAME } from '../ui/boxes'
import { SK_BOX } from '../ui/skeletonView'
import { watchViewport } from '../ui/viewport'

/**
 * The list screen before the data arrives, built from ui/boxes so the real cards land where the
 * placeholders stood and the page does not jump.
 */
export function WaterfallSkeleton(props: { topOffset: () => number }) {
  const { viewportH, frameW } = watchViewport()

  const cols = createMemo(() => waterfallCols(frameW()))
  const cardWidth = createMemo(() => waterfallCardWidth(frameW(), cols()))
  const rowHeight = createMemo(() => waterfallRowHeight(cardWidth()))
  const topPad = createMemo(() => props.topOffset() + VIEW_PAD)
  const rows = createMemo(() => skeletonRows(viewportH(), topPad(), rowHeight()))

  // The wrapper is no taller than the window, so the page cannot scroll while the placeholders
  // are up.
  return (
    <div
      class="relative w-full overflow-hidden sk-pulse"
      style={{
        height: `${Math.min(topPad() + rows() * rowHeight() + VIEW_PAD, viewportH())}px`,
        'padding-top': `${topPad()}px`,
        'padding-right': `calc(${VIEW_PAD}px + var(--safe-right))`,
        'padding-left': `calc(${VIEW_PAD}px + var(--safe-left))`,
      }}
    >
      <div
        class="grid grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
        style={{
          width: `${cols() * cardWidth() + GAP * (cols() - 1)}px`,
          gap: `${GAP}px`,
          '--cols': `${cols()}`,
        }}
      >
        {Array.from({ length: cols() * rows() }, () => (
          <div class={`${CARD_BASE} ${SK_BOX}`}>
            {/* The two heights come from the real card's line boxes: 11px text in a 1.5 line
                with padding makes 28.5px, and 14px text makes 20px. */}
            <div class={`${CARD_ARTIST} h-[28.5px]`}>
              <span class="sk-bar h-[11px] w-[26%] rounded-md" />
              <span class="sk-bar ml-auto h-[11px] w-[18%] rounded-md" />
            </div>
            <div class={CARD_COVER}>
              <div
                class="sk-bar w-full rounded-lg"
                style={{ 'aspect-ratio': String(THUMB_ASPECT) }}
              />
            </div>
            <div class={CARD_BODY}>
              {/* No heart: a fake one that looks clickable is worse than a gap. */}
              <div class={`${CARD_NAME} h-5`}>
                <span class="sk-bar h-[14px] w-[44%] rounded-md" />
              </div>
              {/* Tags are 18px tall, and the price is a 14px glyph in the 20px row. */}
              <div class={CARD_FOOT}>
                <span class="sk-bar h-[18px] w-[24px] rounded-md" />
                <span class="sk-bar h-[18px] w-[24px] rounded-md" />
                <span class="sk-bar ml-auto h-[14px] w-[52px] rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
