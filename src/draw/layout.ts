// Sizes and column math for the two grids: the waterfall on the list screen, and the
// related row inside the detail sheet. Components read these instead of re-deriving them,
// so one edit here moves the whole screen.

// The source covers are 921x597. ListingCard draws them at this ratio, and the waterfall sizes a row
// from it without waiting for any image.
export const THUMB_ASPECT = 921 / 597;

// Everything a card draws around its cover: the frame, the artist row, the text block. None of it
// depends on width, so one number serves every column count.
const CARD_FRAME = 1 + 6 + 28.5 + 56 + 6 + 1; // CARD_BASE borders and p-1.5, CARD_ARTIST, CARD_BODY

// The row math divides the card's own width by THUMB_ASPECT, while the cover is drawn 26px narrower -
// both borders, both card paddings, both cover paddings - so that much picture never appears.
export const CARD_EXTRA_HEIGHT = CARD_FRAME - 26 / THUMB_ASPECT;

// ---- waterfall ----
// Padding around the grid, the gap between cards, the narrowest card the grid accepts,
// the smallest column count, and the rows rendered outside the window so a fast scroll
// shows cards instead of blanks.
export const VIEW_PAD = 16;
export const GAP = 16;
export const MIN_CARD = 236;
export const MIN_COLS = 2;
export const OVERSCAN_ROWS = 6;

/**
 * Columns the grid uses: as many MIN_CARD-wide cards as fit, never fewer than MIN_COLS.
 * A width of 0 means nothing has been measured yet, and that case is a phone.
 */
export function waterfallCols(viewportWidth: number): number {
  if (viewportWidth <= 0) return MIN_COLS;
  return Math.max(
    MIN_COLS,
    Math.floor((viewportWidth - 2 * VIEW_PAD) / MIN_CARD),
  );
}

/**
 * Card width at n columns. Fractional on purpose: the grid places cards by px, and a
 * whole-px width would leave a sliver of padding at the right edge.
 */
export function waterfallCardWidth(
  viewportWidth: number,
  cols: number,
): number {
  return (viewportWidth - 2 * VIEW_PAD - GAP * (cols - 1)) / cols;
}

export function waterfallCardHeight(cardWidth: number): number {
  return cardWidth / THUMB_ASPECT + CARD_EXTRA_HEIGHT;
}

/** The pitch between two rows: a card plus the gap below it. */
export function waterfallRowHeight(cardWidth: number): number {
  return waterfallCardHeight(cardWidth) + GAP;
}

/**
 * The rows a placeholder list draws: every row that starts above the fold, so the last one may show
 * only its top. The real list ends the same way, leaving no empty band above the fold.
 */
export function skeletonRows(
  viewportHeight: number,
  topPad: number,
  rowHeight: number,
): number {
  return Math.max(1, Math.ceil((viewportHeight - topPad) / rowHeight));
}

/** The row an item sits in. A negative index (nothing found) means the first row. */
export function rowOfIndex(index: number, cols: number): number {
  return Math.floor(Math.max(0, index) / cols);
}

/** The first item of a row, clamped to the last item that exists. */
export function indexOfRow(row: number, cols: number, count: number): number {
  return Math.min(row * cols, count - 1);
}

/** The rows a virtual list paints: the ones the window covers, plus `overscan` on each side.
 *  `firstRow` is the visible row at the top of the window, which is what a saved position is
 *  measured in.
 *
 *  `start` never passes `end`: an unmeasured row height, an empty list or a scroll past the end
 *  gives an empty window or the tail of the list, never a negative height or a NaN transform.
 */
export function renderWindow(args: {
  scrollTop: number;
  viewport: number;
  rowHeight: number;
  rowCount: number;
  overscan: number;
}): { firstRow: number; start: number; end: number } {
  const rows = whole(args.rowCount);
  const pitch = atLeastZero(args.rowHeight);
  if (rows === 0 || pitch === 0) return { firstRow: 0, start: 0, end: 0 };
  const y = atLeastZero(args.scrollTop);
  const first = Math.min(rows, Math.floor(y / pitch));
  const last = Math.min(
    rows,
    Math.ceil((y + atLeastZero(args.viewport)) / pitch),
  );
  return {
    firstRow: first,
    start: Math.max(0, first - whole(args.overscan)),
    end: Math.min(rows, last + whole(args.overscan)),
  };
}

/** A count the layout may divide by: nothing fractional, negative, or missing. */
const whole = (n: number): number =>
  Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;

/** A length the layout may divide by: a row height is fractional, so only its sign is fixed. */
const atLeastZero = (n: number): number =>
  Number.isFinite(n) ? Math.max(0, n) : 0;

// ---- detail ----
// Horizontal padding of the sheet body. The related row bleeds out by this amount and back in again,
// so Detail and that row share one number.
export const DETAIL_PAD_X = 16;

// Tailwind's sm breakpoint: the width at which the card's classes start standing in from the edges
// and stop growing, and the width at which a screen has room for two columns.
const SM = 640;

// No tablet is this tall held upright - the tallest one reports 1366. Above the line the window is a
// desktop layout, and `cardGap` takes its last step there.
export const TALL_WINDOW_H = 1400;

// The panel's two columns, as one literal: Tailwind reads these numbers off the source, so a string
// assembled at runtime never reaches the stylesheet and the table would take an implicit column as
// wide as it likes. The table gets half the room up to 420, never less than 260 - 24 of card padding,
// a 60px label column, a 12 gap, 164 of values. No row track is named: the table column is laid out
// of that flow (see DetailBody), so the row is the gallery column's height.
export const PANEL_GRID =
  "grid grid-cols-[minmax(0,1fr)_minmax(260px,min(50%,420px))] gap-6";

// The widest a panel stands before its art column asks for more. The table column keeps its own cap,
// so growth past this goes to the art alone and the reading line stays as short as it was.
export const SPREAD_MAX_W = 1080;

/** The gap `PANEL_GRID` puts between the two columns: gap-6. */
const PANEL_GAP = 24;

/** The table column's width, as `PANEL_GRID` resolves minmax(260px,min(50%,420px)). The body pads the
 *  sides, so the grid is narrower than the room the card leaves by 2 of DETAIL_PAD_X. */
export function panelInfoWidth(roomW: number): number {
  const grid = roomW - 2 * DETAIL_PAD_X;
  return Math.max(260, Math.min(grid / 2, 420));
}

/** The column the art gets in a card whose content room is this wide. */
export function panelArtWidth(roomW: number): number {
  return roomW - 2 * DETAIL_PAD_X - PANEL_GAP - panelInfoWidth(roomW);
}

/** The widest the art's box stands against its own height: 3 wide to 2 high, past which a picture
 *  reads as a banner. */
const PIC_PANEL_WIDE = 1.5;

/** How much of each side band falls inside the card. A band reaches the card only where the card
 *  reaches into it, so one the gap stands further in than the band keeps none of it. */
export function cardBands(gap: number, safe: Insets): Insets {
  return {
    top: 0,
    right: Math.max(0, safe.right - gap),
    bottom: safe.bottom,
    left: Math.max(0, safe.left - gap),
  };
}

/** The detail's two shapes: a sheet is the one-column card that comes up from the bottom, a panel is
 *  the two-column view a window too short for one column gets instead. A tall window is not a panel:
 *  a panel's columns stretch to whatever the card is, so it can only ever be as tall as the window,
 *  while a sheet stands as tall as its content and floats in the room that is left. */
export type Shape = "sheet" | "panel";

export function shapeAt(viewportW: number, viewportH: number): Shape {
  return viewportW >= SM && viewportW >= viewportH ? "panel" : "sheet";
}

/** The ladder `cardGap` walks: none under 480 - a band that thin is not something a finger or a
 *  cursor aims at - then 12, 24, 48, and 96 from TALL_WINDOW_H up. The last step matches the side
 *  room SPREAD_MAX_W already leaves a 1280-wide window: about 100px, so the four edges read as one
 *  family instead of a card wedged in sideways.
 */
export function sheetInset(viewportH: number): number {
  if (viewportH < 480) return 0;
  if (viewportH < 700) return 12;
  if (viewportH < 900) return 24;
  return viewportH < TALL_WINDOW_H ? 48 : 96;
}

export type CardBox = { w: number; h: number };

/** The side bands that fall inside the card, as padding; the bottom band belongs to the scroller
 *  below. `--sheet-gap` is how far the card stands in from the window: the part of a band it never
 *  reaches. iOS updates the bands after the resize that a turn fires, so they are read from `env()`
 *  where they are painted rather than from a number a script measured once. */
export const CARD_BAND_PAD =
  "pl-[max(0px,calc(var(--safe-left)-var(--sheet-gap,0px)))] " +
  "pr-[max(0px,calc(var(--safe-right)-var(--sheet-gap,0px)))]";

/** The band at the bottom of the screen, as the padding of whatever scrolls: content runs on to the
 *  edge, and this is what lets the last row be scrolled clear of it. */
export const SCROLL_BAND_PAD =
  "pb-[var(--safe-bottom)] scroll-pb-[var(--safe-bottom)]";

/** The bands the screen itself takes at its four edges, in px. */
export type Insets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** The gap the card keeps at every edge of the window. The page behind shows through here, which is
 *  what makes the card read as sitting on the page rather than taking it over. A card that stands in
 *  from the edges pays the same gap whichever shape it is in; one that fills the phone's width pays
 *  nothing.
 */
export function cardGap(viewportW: number, viewportH: number): number {
  return viewportW >= SM ? sheetInset(viewportH) : 0;
}

/** The card's own outer width: the window less the gap it stands in, the side bands included - a card
 *  that reaches an edge pads them inside, the way the scroller pads the bottom. `sheetCardBox` cuts
 *  the content's room out of this. Growth is one pass: the picture's height is read from the card
 *  before it widens, and widening cannot raise a height the window already binds. */
export function sheetCardOuterW(
  viewportW: number,
  viewportH: number,
  safe: Insets = NO_INSETS,
): number {
  const gap = cardGap(viewportW, viewportH);
  const bands = cardBands(gap, safe);
  const availW = viewportW - 2 * gap;
  const roomH = viewportH - 2 * gap - safe.bottom;
  if (shapeAt(viewportW, viewportH) !== "panel") return Math.min(availW, 760);
  const base = Math.min(availW, SPREAD_MAX_W);
  const room = base - bands.left - bands.right;
  const want = Math.ceil(
    detailPictureHeight({ w: room, h: roomH }, "panel", safe.top) *
      PIC_PANEL_WIDE,
  );
  return Math.min(availW, base + Math.max(0, want - panelArtWidth(room)));
}

/** The room the card leaves its own content: the card's own box less the side bands that fall inside
 *  it, less the bottom band. The detail measures its two columns against this.
 */
export function sheetCardBox(
  viewportW: number,
  viewportH: number,
  safe: Insets = NO_INSETS,
): CardBox {
  const gap = cardGap(viewportW, viewportH);
  const bands = cardBands(gap, safe);
  return {
    w: sheetCardOuterW(viewportW, viewportH, safe) - bands.left - bands.right,
    h: viewportH - 2 * gap - safe.bottom,
  };
}

/** The room above the art: the close button's row and the air under it, plus the screen's band on top
 *  of both. The row moves down with the band, so the two add: a clearance that only reaches past the
 *  button leaves the button sitting on the art. `DETAIL_TOP` is the same measure in a class: 1rem of
 *  edge, the 2.75rem button (`SHEET_FAB_BOX`), and 8 of air. */
const detailTopClear = (safeTop: number): number => 16 + 44 + 8 + safeTop;
const DETAIL_TOP = "pt-[calc(4.25rem+var(--safe-top))]";
/** The air under the body's content, which both shapes keep the same. */
const DETAIL_BODY_BOTTOM = 16;

/** The detail's box model, one row per shape, so the whole of it is read in one place: who pads the
 *  body, who pads a column, how the action bar and the related strip meet the edges. */
export const BOX: Record<
  Shape,
  {
    bodyPad: string;
    colPad: string;
    /** A sheet's bar stands outside the scroller, so it keeps the bottom band itself. */
    barPad: string;
    stripBleed: number;
  }
> = {
  // The body pads all four sides, so the strip and the bar pay that side padding back to reach the
  // card's edge.
  sheet: {
    bodyPad: `${DETAIL_TOP} pb-4`,
    colPad: "",
    stripBleed: DETAIL_PAD_X,
    barPad: "px-4 pb-[max(0.75rem,var(--safe-bottom))]",
  },
  // The body pads the sides only, and both columns carry the same top and bottom, which keeps them
  // level when the panel opens.
  panel: {
    bodyPad: "",
    colPad: `${DETAIL_TOP} pb-4`,
    stripBleed: 0,
    barPad: "pb-3",
  },
};

// The parts of the first screen that never move: the clearance above the art and the air under the
// body. Both cost the same in either shape: the body's own padding in a sheet, the column's in a
// panel.
const detailChrome = (safeTop: number): number =>
  detailTopClear(safeTop) + DETAIL_BODY_BOTTOM;
const DETAIL_STRIP_H = 68; // mt-2 + the 60px thumbs
const SHEET_BAR_H = 61; // py-3 + a 36px control + the border above it

// A sheet's art box stops at 1.1 times its own width, so a square picture fills it, and at the room
// the screen has left once its padding, the thumbs and the bar are paid for, so the table stays on
// the first screen. Under 120 the art is not worth looking at - the zoom is how you look at one that
// small.
const PIC_TALL = 1.1;
const PIC_MIN_H = 120;

/** Half the card: what the art is allowed to hold in a sheet. */
const PIC_CAP = 0.5;
// A panel's art stops at this share of its own card, which holds the box upright in a window too
// narrow to grow the card. PIC_PANEL_WIDE is the same rule where the window has room to spare.
const PIC_PANEL_MAX = 0.75;

/** The height the art's box takes: a panel hands over its whole left column, a sheet fits the art to
 *  its card, keeps the bar's height outside the scroller, and stops at `PIC_CAP` of the card. A
 *  sheet is one column, so a taller cover leaves the table below the fold entirely. */
export function detailPictureHeight(
  box: CardBox,
  shape: Shape,
  safeTop = 0,
): number {
  const room =
    box.h -
    detailChrome(safeTop) -
    DETAIL_STRIP_H -
    (shape === "panel" ? 0 : SHEET_BAR_H);
  if (shape === "panel")
    return Math.max(PIC_MIN_H, Math.min(room, box.w * PIC_PANEL_MAX));
  const fitted = Math.min(
    Math.max(PIC_MIN_H, (box.w - 2 * DETAIL_PAD_X) * PIC_TALL),
    Math.max(PIC_MIN_H, room),
  );
  return Math.min(fitted, box.h * PIC_CAP);
}

// The strip under the info table. A card's width follows the width the strip has, so a view holds a
// whole number of cards: the 194 target is what two cards get on a phone once the gaps are paid,
// while a wider strip fits 3 or 4. One fixed width cannot do both.
export const RELATED_CARD_TARGET = 194;
export const RELATED_CARD_GAP = 14;
export const RELATED_PER_VIEW_MIN = 2;
export const RELATED_PER_VIEW_MAX = 4;
// Below this a cover stops being recognizable: the strip shows one full card, most of the next, and
// scrolls. layout.test.ts names the widths where that happens.
export const RELATED_CARD_MIN = 160;

/** How many cards fit: available width over the target, rounded, clamped to 2..4. */
export function relatedPerView(avail: number): number {
  return Math.min(
    RELATED_PER_VIEW_MAX,
    Math.max(RELATED_PER_VIEW_MIN, Math.round(avail / RELATED_CARD_TARGET)),
  );
}

/** Width per card at n cards. Floored, so rounding never reveals half a card. */
export function relatedCardWidth(avail: number, n: number): number {
  return Math.max(
    RELATED_CARD_MIN,
    Math.floor((avail - RELATED_CARD_GAP * (n - 1)) / n),
  );
}

// The name and #ID line under a cover: 4px of padding plus a 20px line box, measured in
// the browser at every card width.
export const RELATED_CAPTION_H = 24;

export function relatedCardsHeight(cardWidth: number): number {
  return cardWidth / THUMB_ASPECT + RELATED_CAPTION_H;
}

// The progress bar under the related cards. A full-width bar looks like a divider between
// sections, so the track stays short.
export const RELATED_BAR_W = 120;
export const RELATED_BAR_H = 3;
export const RELATED_BAR_GAP = 14;
// Below this the thumb is hard to see.
export const RELATED_BAR_MIN_THUMB = 24;
// A bar that is being held is easier to keep hold of, so it runs thicker. The paint sits centered
// inside the reserved box, so the sheet's height does not follow it.
export const RELATED_BAR_H_HELD = 6;
// The area a finger can grab around the track. It is painted outside the box, so it costs no room.
export const RELATED_BAR_HIT_X = 12;
export const RELATED_BAR_HIT_Y = 8;

/** The empty states take this much room, so the sheet's height is the same whether the
 *  strip is empty or full. */
export function relatedStripHeight(cardWidth: number): number {
  return relatedCardsHeight(cardWidth) + RELATED_BAR_H + RELATED_BAR_GAP;
}

// ---- the two bands the screen takes ----

/** The band's distance from the page edge. The corner's circles sit on the same 16px. */
export const CHROME_EDGE = 16;

/** The air between the picture's box and the plate's edge on all four sides. boxes.ts writes the
 *  same number as padding, and the drop zone's corner subtracts the plate's 1px border. */
export const PICTURE_INSET = 12;
/** The plate's own edge, twice over: once per side. */
const PLATE_EDGE = 2;

/** The field's four shapes. */
export const FIELD_REST = 48;
export const FIELD_TEXT = 60;
// the mark's centre is the plate's corner centre, so it reads as the corner's contents
export const FIELD_LEAD = 60;
/** The staged picture: a 72px picture with the inset all around it. */
export const FIELD_PICTURE = 72 + PICTURE_INSET * 2 + PLATE_EDGE;
/** The empty drop zone: 122px of target with the same inset. */
export const FIELD_DROP = 122 + PICTURE_INSET * 2 + PLATE_EDGE;

/** The air between the box and the first row. */
export const CHROME_LIST_GAP = 8;

/** The room the box leaves for the corner's filter circle at every height: the circle and the 8px
 *  between them. */
export const PLATE_AIR = `calc(var(--fab-size) + 0.5rem)`;

/** Where the app stops being a phone: the same 640 the detail card detaches at. */
export const CHROME_WIDE = 640;

/** A fixed measure for an open box on a wide edge, instead of the whole edge. */
export const FIELD_WIDE = 440;

/** The room the box takes once it holds a picture and an answer under it - the height the user
 *  reads at, whether the answer arrived or the search broke. It does not follow the picture switch:
 *  a switch the user can flip must not move every row. The empty drop zone is the one state that
 *  hangs past it, over the row's own top padding. */
export function chromeTop(safeTop: number): number {
  return CHROME_EDGE + safeTop + FIELD_PICTURE + CHROME_LIST_GAP;
}

/** The tabs stand at the bottom edge, on the same air the band keeps at the top. */
export const PILL_H = 56;

/** What the last thing on the page keeps free below itself: the tabs and the air under them. */
export const LIST_BOTTOM = CHROME_EDGE + PILL_H + GAP;

// ---- row preview chip ----
// The chip sits at the right edge while you scroll. It shows the day of the row at the top of
// the window, or that row's price when the list is sorted by price.
export const PREVIEW_H = 36;
export const PREVIEW_SCROLLBAR_GAP = 8;
export const PREVIEW_IDLE_MS = 700;
// past the chip's own 300ms fade, so it leaves after the fade rather than partway through
export const PREVIEW_FADE_MS = 400;
