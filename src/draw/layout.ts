// Sizes and column math for the two grids: the waterfall on the list screen, and the
// related row inside the detail sheet. Components read these instead of re-deriving them,
// so one edit here moves the whole screen.

// The source covers are 921x597. ListingCard draws them at this ratio, and the waterfall
// estimates a row's height from it before any image loads.
export const THUMB_ASPECT = 921 / 597

// Everything under a cover: price line, name line, tag line. A card is
// width / THUMB_ASPECT + this. Measured at four card widths (191, 236.8, 278.66, 326) and
// each gave 81.63 to 81.64, so the number does not move with width.
// Change anything at the bottom of a card and re-measure, or the row pitch and the card
// gap stop matching: this is (real card height - width * 597 / 921).
export const CARD_EXTRA_HEIGHT = 81.63

// ---- waterfall ----
// Padding around the grid, the gap between cards, the narrowest card the grid accepts,
// the smallest column count, and the rows rendered outside the window so a fast scroll
// shows cards instead of blanks.
export const VIEW_PAD = 16
export const GAP = 16
export const MIN_CARD = 236
export const MIN_COLS = 2
export const OVERSCAN_ROWS = 6

// The copyright band under the last row.
export const FOOTER_H = 72

/**
 * Columns the grid uses: as many MIN_CARD-wide cards as fit, never fewer than MIN_COLS.
 * A width of 0 means nothing has been measured yet, and that case is a phone.
 */
export function waterfallCols(viewportWidth: number): number {
  if (viewportWidth <= 0) return MIN_COLS
  return Math.max(MIN_COLS, Math.floor((viewportWidth - 2 * VIEW_PAD) / MIN_CARD))
}

/**
 * Card width at n columns. Fractional on purpose: the grid places cards by px, and a
 * whole-px width would leave a sliver of padding at the right edge.
 */
export function waterfallCardWidth(viewportWidth: number, cols: number): number {
  return (viewportWidth - 2 * VIEW_PAD - GAP * (cols - 1)) / cols
}

export function waterfallCardHeight(cardWidth: number): number {
  return cardWidth / THUMB_ASPECT + CARD_EXTRA_HEIGHT
}

/** The pitch between two rows: a card plus the gap below it. */
export function waterfallRowHeight(cardWidth: number): number {
  return waterfallCardHeight(cardWidth) + GAP
}

/** The row an item sits in. A negative index (nothing found) means the first row. */
export function rowOfIndex(index: number, cols: number): number {
  return Math.floor(Math.max(0, index) / cols)
}

/** The first item of a row, clamped to the last item that exists. */
export function indexOfRow(row: number, cols: number, count: number): number {
  return Math.min(row * cols, count - 1)
}

// ---- detail sheet ----
// Horizontal padding of the sheet body. The related row bleeds out by this amount and
// back in again, so Detail and that row share one number.
export const DETAIL_PAD_X = 16

// The strip under the info table. Card width follows the width available to the strip, so
// a view holds a whole number of cards: the target is 194px, which is what two cards get
// on a phone once the gaps are paid, and a wider strip fits 3 or 4, so a 430px sheet shows
// 2 and a 760px sheet shows 4. One fixed width cannot do both.
export const RELATED_CARD_TARGET = 194
export const RELATED_CARD_GAP = 14
export const RELATED_PER_VIEW_MIN = 2
export const RELATED_PER_VIEW_MAX = 4
// The floor keeps a cover recognizable. Below it (available width under 334) the strip
// shows one full card and most of the next, and it scrolls. layout.test.ts names the
// widths where the floor wins and the row overflows a little.
export const RELATED_CARD_MIN = 160

/** How many cards fit: available width over the target, rounded, clamped to 2..4. */
export function relatedPerView(avail: number): number {
  return Math.min(RELATED_PER_VIEW_MAX, Math.max(RELATED_PER_VIEW_MIN, Math.round(avail / RELATED_CARD_TARGET)))
}

/** Width per card at n cards. Floored, so rounding never reveals half a card. */
export function relatedCardWidth(avail: number, n: number): number {
  return Math.max(RELATED_CARD_MIN, Math.floor((avail - RELATED_CARD_GAP * (n - 1)) / n))
}

// The name and #ID line under a cover: 4px of padding plus a 20px line box, measured in
// the browser at every card width.
export const RELATED_CAPTION_H = 24

/**
 * Height of one row of related cards. The empty state reserves this much space, so
 * switching views cannot shove the sheet's content up or down.
 */
export function relatedRowHeight(cardWidth: number): number {
  return cardWidth / THUMB_ASPECT + RELATED_CAPTION_H
}

// ---- row preview chip ----
// The chip rides the right edge while you scroll, and shows the id or price of the row at
// the top of the window.
export const PREVIEW_H = 36
export const PREVIEW_IDLE_MS = 700
// The chip's own CSS fade runs 300ms (duration-300). This waits longer on purpose, so the
// element leaves after its fade instead of partway through it.
export const PREVIEW_FADE_MS = 400
