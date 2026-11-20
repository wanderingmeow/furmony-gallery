// Sizes and column math for the two grids: the waterfall on the list screen, and the
// related row inside the detail sheet. Components read these instead of re-deriving them,
// so one edit here moves the whole screen.

// The source covers are 921x597. ListingCard draws them at this ratio, and the waterfall sizes a row
// from it without waiting for any image.
export const THUMB_ASPECT = 921 / 597

// Everything a card draws around its cover: the frame, the artist row, the text block. None of it
// depends on width, so one number serves every column count.
const CARD_FRAME = 1 + 6 + 28.5 + 56 + 6 + 1 // CARD_BASE borders and p-1.5, CARD_ARTIST, CARD_BODY

// The row math divides the card's own width by THUMB_ASPECT, while the cover is drawn 26px narrower -
// both borders, both card paddings, both cover paddings - so that much picture never appears.
export const CARD_EXTRA_HEIGHT = CARD_FRAME - 26 / THUMB_ASPECT

// ---- waterfall ----
// Padding around the grid, the gap between cards, the narrowest card the grid accepts,
// the smallest column count, and the rows rendered outside the window so a fast scroll
// shows cards instead of blanks.
export const VIEW_PAD = 16
export const GAP = 16
export const MIN_CARD = 236
export const MIN_COLS = 2
export const OVERSCAN_ROWS = 6

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

/**
 * The rows a placeholder list draws: every row that starts above the fold, so the last one may show
 * only its top. The real list ends the same way, leaving no empty band above the fold.
 */
export function skeletonRows(viewportHeight: number, topPad: number, rowHeight: number): number {
  return Math.max(1, Math.ceil((viewportHeight - topPad) / rowHeight))
}

/** The row an item sits in. A negative index (nothing found) means the first row. */
export function rowOfIndex(index: number, cols: number): number {
  return Math.floor(Math.max(0, index) / cols)
}

/** The first item of a row, clamped to the last item that exists. */
export function indexOfRow(row: number, cols: number, count: number): number {
  return Math.min(row * cols, count - 1)
}

// ---- detail ----
// Horizontal padding of the sheet body. The related row bleeds out by this amount and back in again,
// so Detail and that row share one number.
export const DETAIL_PAD_X = 16

// Tailwind's sm breakpoint: the width at which the card's classes start standing in from the edges
// and stop growing, and the width at which a screen has room for two columns.
const SM = 640

// The panel's two columns, as one literal: Tailwind reads these numbers off the source, and a string
// assembled at runtime never reaches the stylesheet, leaving the table an implicit column as wide as
// it likes. The table gets half the room, capped at 420 so its lines stay readable, and never less
// than 260 - 24 of card padding, a 60px label column, a 12 gap, 164 of values.
export const PANEL_GRID =
  'grid grid-cols-[minmax(0,1fr)_minmax(260px,min(50%,420px))] grid-rows-[minmax(0,1fr)] gap-6'

// The widest a panel gets. Past this the table's lines stretch past comfortable reading, and the
// list behind needs air.
export const SPREAD_MAX_W = 1080

/** The detail's two shapes: a sheet is the phone's one-column card slid up from the bottom, a panel
 *  is the two-column view a landscape screen gets instead. */
export type Shape = 'sheet' | 'panel'

export function shapeAt(viewportW: number, viewportH: number): Shape {
  return viewportW >= SM && viewportW >= viewportH ? 'panel' : 'sheet'
}

/** The gap a panel leaves at every edge: it is what makes a panel read as a card on the page instead
 *  of a takeover, so it grows with the height there is to spare. None under 480 - a band that thin is
 *  not something a finger or a cursor aims at - then 12, 24, and 48 from 900 up.
 */
export function sheetInset(viewportH: number): number {
  if (viewportH < 480) return 0
  if (viewportH < 700) return 12
  return viewportH < 900 ? 24 : 48
}

export type CardBox = { w: number; h: number }

/** The box the card takes, the way its classes draw it: the window, standing 24 in from every edge
 *  from SM up (sm:px-6, sm:py-6) and never wider than 760 (sm:max-w-190). A panel swaps that gap for
 *  sheetInset and that width for SPREAD_MAX_W.
 */
export function sheetCardBox(viewportW: number, viewportH: number): CardBox {
  const panel = shapeAt(viewportW, viewportH) === 'panel'
  const edge = panel ? sheetInset(viewportH) : viewportW >= SM ? 24 : 0
  return { w: Math.min(viewportW - 2 * edge, panel ? SPREAD_MAX_W : 760), h: viewportH - 2 * edge }
}

/** The detail's box model, one row per shape, so the whole of it is read in one place: who pads the
 *  body, who pads a column, how the action bar and the related strip meet the edges. */
export const BOX: Record<Shape, {
  bodyPad: string
  colPad: string
  barPad: string
  stripBleed: number
}> = {
  // The body pads all four sides, so the strip and the bar pay that side padding back to reach the
  // card's edge.
  sheet: { bodyPad: 'pt-16 pb-4', colPad: '', barPad: 'px-4', stripBleed: DETAIL_PAD_X },
  // The body pads the sides only, and both columns carry the same top and bottom, which keeps them
  // level when the panel opens.
  panel: { bodyPad: '', colPad: 'pt-16 pb-4', barPad: '', stripBleed: 0 },
}

// The parts of the first screen that never move. 64 of clearance above the art and 16 under it cost
// the same in both shapes: pt-16 + pb-4 in a sheet, pt-16 + the column gap in a panel.
const DETAIL_CHROME = 80
const DETAIL_STRIP_H = 68 // mt-2 + the 60px thumbs
const SHEET_BAR_H = 61 // py-3 + a 36px control + the border above it

/** The body's box: a sheet's less its padding, a panel's entire, since a panel pads its columns. */
export function detailBodyHeight(box: CardBox, shape: Shape): number {
  return shape === 'panel' ? box.h : box.h - DETAIL_CHROME
}

// A sheet's art box stops at 1.1 times its own width, so a square picture fills it, and at the room
// the screen has left once its padding, the thumbs and the bar are paid for, so the table stays on
// the first screen. Under 120 the art is not worth looking at - the zoom is how you look at one that
// small.
const PIC_TALL = 1.1
const PIC_MIN_H = 120

/** The height the art's box takes: a panel hands over its whole left column, a sheet fits the art to
 *  the screen and keeps the bar's height outside the scroller. */
export function detailPictureHeight(box: CardBox, shape: Shape): number {
  const room = box.h - DETAIL_CHROME - DETAIL_STRIP_H - (shape === 'panel' ? 0 : SHEET_BAR_H)
  if (shape === 'panel') return Math.max(PIC_MIN_H, room)
  return Math.min(Math.max(PIC_MIN_H, (box.w - 2 * DETAIL_PAD_X) * PIC_TALL), Math.max(PIC_MIN_H, room))
}

// The strip under the info table. A card's width follows the width the strip has, so a view holds a
// whole number of cards: the 194 target is what two cards get on a phone once the gaps are paid,
// while a wider strip fits 3 or 4. One fixed width cannot do both.
export const RELATED_CARD_TARGET = 194
export const RELATED_CARD_GAP = 14
export const RELATED_PER_VIEW_MIN = 2
export const RELATED_PER_VIEW_MAX = 4
// Below this a cover stops being recognizable: the strip shows one full card, most of the next, and
// scrolls. layout.test.ts names the widths where that happens.
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

export function relatedCardsHeight(cardWidth: number): number {
  return cardWidth / THUMB_ASPECT + RELATED_CAPTION_H
}

// The progress bar under the related cards. A full-width bar looks like a divider between
// sections, so the track stays short.
export const RELATED_BAR_W = 120
export const RELATED_BAR_H = 3
export const RELATED_BAR_GAP = 8
// Below this the thumb is hard to see.
export const RELATED_BAR_MIN_THUMB = 24

/** The empty states take this much room, so the sheet's height is the same whether the
 *  strip is empty or full. */
export function relatedStripHeight(cardWidth: number): number {
  return relatedCardsHeight(cardWidth) + RELATED_BAR_H + RELATED_BAR_GAP
}

// ---- top bar ----
// The bar's bottom edge, summed from the class strings `BAR_BANNER`, `BAR_ROW` and `BAR_TABS`, and
// 110px in the browser. The list reserves this much so the cards start under the bar. Picture mode
// changes the bar's rows and the page is at the top by then, so the sum holds either way.
export const BAR_BOTTOM = 12 + 1 + 12 + 32 + 8 + 32 + 12 + 1


// ---- row preview chip ----
// The chip sits at the right edge while you scroll. It shows the day of the row at the top of
// the window, or that row's price when the list is sorted by price.
export const PREVIEW_H = 36
export const PREVIEW_SCROLLBAR_GAP = 8
export const PREVIEW_IDLE_MS = 700
// The chip's own CSS fade runs 300ms (duration-300). This waits longer on purpose, so the
// element leaves after its fade instead of partway through it.
export const PREVIEW_FADE_MS = 400
