// src/components/ui/boxes.ts - the boxes a skeleton shares with the screen it stands in for, so
// the two cannot drift apart.
import { createContext, useContext } from "solid-js";

/** The fill that stands in for a picture while it loads. */
export const SK_FILL = "sk-bar sk-pulse";

export const CARD_BASE = "rounded-xl bg-surface border border-border p-1.5";
export const CARD_ARTIST = "flex items-center gap-1.5 px-2 py-1.5";
export const CARD_COVER = "px-1.5";
export const CARD_BODY = "px-2 pt-1.5 pb-1.5 space-y-1";
export const CARD_NAME = "flex items-center gap-1.5";
export const CARD_FOOT = "flex min-h-5 items-center gap-1.5";

export const SORT_BTN = "h-8 rounded-lg";

/* ---- the top band ----
   Nothing at the top edge is where a keyboard can reach, and the band has no part in the
   document's layout: a field that outgrows the bar hangs below it over the cards, and the list
   reserves the room the field takes at its tallest (chromeTop in draw/layout.ts). */

export const CHROME_BAND = `fixed inset-x-0 top-0 z-40 pointer-events-none
  pl-[calc(1rem+var(--safe-left))] pr-[calc(1rem+var(--safe-right))]
  pt-[calc(1rem+var(--safe-top))]`;

export const CHROME_BAR_BOX = "relative h-[var(--bar-h)]";

/** No padding or border of its own, so `100cqw` is one width whichever box an engine measures a
 *  container against. */
export const CHROME_LINE = `[container-type:inline-size]
  absolute inset-0 grid grid-cols-[1fr_auto] items-center pointer-events-none`;

/** A keyboard may cover these. The field stands at the other edge, so the list stays scrollable
 *  while the user types. */
export const CHROME_TAB_BAR = `[container-type:inline-size]
  fixed inset-x-0 bottom-0 z-40 flex justify-center pointer-events-none
  pl-[calc(1rem+var(--safe-left))] pr-[calc(1rem+var(--safe-right))]
  pb-[calc(1rem+var(--safe-bottom))]`;

/* The pill's shadow is painted on this element's `::before` (index.css), so the dissolve mask on
   the glass never clips it. */
export const CHROME_PILL = "relative";

/** `flex-row-reverse` puts the funnel on the edge and … on its left, where the edge gives that
 *  circle back to the box. */
export const CHROME_CORNER = `col-start-2 justify-self-end flex flex-row-reverse items-center gap-2
  pointer-events-auto`;

/** The charts stand beside the search circle, so they stand in by the circle's own width plus the
 *  gap the corner pays. An open box is the user working inside the list, so index.css shrinks this
 *  circle away while one is open. */
export const CHROME_STATS = `col-start-1 justify-self-start flex items-center
  pl-[calc(var(--fab-size)+0.5rem)] pointer-events-auto`;

/** `top` centres the box on the bar. A box taller than the bar cannot centre without rising above it,
 *  so it takes at most --field-rise: the 60px text box takes 2px and stays centred, and the taller
 *  boxes stop at that line and grow downward, over the cards.
 *
 *  --field-h and --chrome-acts arrive inline: two classes writing one custom property would be settled
 *  by stylesheet order. */
export const CHROME_FIELD = `absolute left-0 right-0 h-[var(--field-h)]
  top-[max(calc(var(--field-rise)*-1),calc((var(--bar-h)-var(--field-h))/2))]
  transition-[height,top] duration-300
  ease-chrome motion-reduce:transition-none`;

/** One element is both the circle and the box, and its left edge never moves, so the circle reads
 *  as the object that grew. --plate-r is written on the field, one level above, because the drop
 *  zone in the rows borrows it. The 300ms growth and the 140ms press are in index.css. */
export const CHROME_PLATE =
  "absolute inset-0 overflow-hidden border border-border rounded-[var(--plate-r)]";
export const CHROME_PLATE_REST = "chrome-glass fab-circle";
/** The plate is the whole box, so it takes the tap a user aims at the field itself. */
export const CHROME_PLATE_BOX =
  "glass chrome-glass shadow-sm dark:shadow-md pointer-events-auto";
export const PLATE_OPEN_R = "28px";
/* Half the circle: a radius above the clamp would be held there, and the corner would change
   shape only in the last frames. */
export const PLATE_REST_R = "calc(var(--fab-size) / 2)";

/** Holds the centre of the left end: a 48 circle at rest, a 60 box once open. */
export const CHROME_HIT = `absolute left-0 inset-y-0 w-[var(--field-lead)] grid place-items-center z-3
  cursor-pointer text-xl text-ink pointer-events-auto transition-[transform,opacity,width] duration-300
  ease-chrome active:scale-[0.92] motion-reduce:transition-none`;

/** The row is transparent to taps and its controls are not, so it can hold the plate's full height.
 *  `invisible` rather than opacity alone: a transparent row would still take the tap that belongs
 *  to the circle. */
export const CHROME_ROW = `absolute inset-0 flex gap-1 pointer-events-none
  transition-opacity duration-300 ease-chrome motion-reduce:transition-none
  [&_input]:pointer-events-auto [&_button]:pointer-events-auto [&_label]:pointer-events-auto`;
export const CHROME_ROW_OUT = "invisible opacity-0";
export const CHROME_ROW_TEXT = "items-center";
/** The row spans the field, so its right inset is the circles plus --plate-air: the distance the
 *  plate stands back from the field's edge. */
export const CHROME_ROW_PICTURE =
  "items-stretch p-3 pr-[calc(var(--chrome-acts)+0.5rem+var(--plate-air,0px))]";
/** Keeps the lit circle's width clear: these words are text and would read through it. */
export const CHROME_PICT_STAGED = "pr-11";
/** Concentric with the plate: the edges sit PICTURE_INSET apart, so the inside curve loses that much. */
export const CHROME_DROP_R = "rounded-[calc(var(--plate-r)-12px)]";

/* A percentage here is measured against the plate's padding box, so the circles ride its edge. */
export const CHROME_ACTS_HOLD = "absolute left-0 inset-y-0 w-full";
/* Pinned to the plate's top edge and centred on the text box's content height, so the circles hold
   their place against the text while the picture box grows below them. The 9px on the right is the
   gap the plate's 1px borders leave above and below. */
/* Their appearance and whether they take taps is `[data-chrome="acts"]` in index.css. */
export const CHROME_ACTS = `absolute top-0 right-[9px] flex items-center gap-2 z-[5]
  h-[calc(var(--field-text)-2px)]`;

/** Where the field's text starts: past the mark that opens it. */
export const CHROME_TEXT_IN = "pl-[calc(var(--field-lead)/2+20px)]";
/* The same right inset as the reel: both rows span the field, which reaches further right than the
   plate does while the box is open. */
export const CHROME_TEXT_OUT =
  "pr-[calc(var(--chrome-acts)+4px+var(--plate-air,0px))]";
export const CHROME_REEL = `absolute left-[calc(var(--field-lead)/2+20px)] inset-y-0
  right-[calc(var(--chrome-acts)+4px+var(--plate-air,0px))]
  flex items-center overflow-hidden pointer-events-none select-none`;

export const SHEET_FAB_ROW = `absolute z-20 flex items-center gap-2
  top-[calc(1rem+var(--safe-top))] left-[calc(1rem+var(--safe-left))]`;

/** The art block, the same height wherever it appears. */
export const ART_PLACEHOLDER = "h-72 w-full rounded-xl";

/** GallerySkeleton draws the same strip, so the thumbs cannot push the table down when they arrive. */
export const DETAIL_THUMB_ROW = "flex gap-1.5 justify-center mt-2";
export const DETAIL_THUMB = "w-15 h-15 shrink-0 rounded-md";

// shared with SheetSkeleton, so the placeholder cannot land a few pixels from the real header
export const SHEET_HEADER_ROW = `flex items-center gap-4 px-4 pb-4 bg-canvas
  pt-[calc(1rem+var(--safe-top))]`;
export const SHEET_FAB_BOX = "w-11 h-11";
export const SHEET_TITLE = "text-lg font-semibold text-ink";

/** The box at a sheet's foot, empty until a screen claims it with a Portal. The sheet creates it
 *  before any child renders. Outside a sheet there is no box. */
export const SheetFooterSlot = createContext<HTMLElement | undefined>(
  undefined,
);
export const useSheetFooter = () => useContext(SheetFooterSlot);
