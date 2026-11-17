import { createContext, useContext } from 'solid-js'

/**
 * The boxes that a skeleton shares with the screen that it stands in for, so the two cannot drift
 * apart. Behavior stays with the component that needs it: `group`, and the pointer-events that
 * allow a bar to receive touches, are written there.
 */

/** The fill that stands in for a picture while it loads. SkelImg uses it, and so does the gallery
 *  skeleton. */
export const SK_FILL = 'sk-bar sk-pulse'

export const CARD_BASE = 'rounded-xl bg-surface border border-border p-1.5'
export const CARD_ARTIST = 'flex items-center gap-1.5 px-2 py-1.5'
export const CARD_COVER = 'px-1.5'
export const CARD_BODY = 'px-2 pt-1.5 pb-1.5 space-y-1'
export const CARD_NAME = 'flex items-center gap-1.5'
export const CARD_FOOT = 'flex min-h-5 items-center gap-1.5'

export const BAR_BANNER = `glass relative z-40 px-3 py-3 rounded-2xl border border-black/10
  shadow-sm dark:shadow-md mx-4 mt-3`
export const BAR_ROW = 'flex items-center gap-2'
export const BAR_TABS = 'mt-2'
export const SORT_BTN = 'h-8 rounded-lg'
export const TABS_ROW = 'flex items-center gap-1.5'

export const SHEET_FAB_ROW = 'absolute top-4 left-4 z-20 flex items-center gap-2'

/** The sheet's vertical padding. The skeleton and the real sheet share it, so the body does not
 *  shift when the data lands. */
export const DETAIL_BODY = 'pt-16 pb-4'
/** The art block, the same height wherever it appears: the sheet skeleton, the gallery skeleton,
 *  and the box that stands in for a listing with no art. */
export const ART_PLACEHOLDER = 'h-72 w-full rounded-xl'

/** The strip of thumbnails under the gallery. GallerySkeleton draws the same strip while the
 *  first picture loads, because the list already says how many pictures there are. A strip that
 *  arrives later would push the table below it down. */
export const DETAIL_THUMB_ROW = 'flex gap-1.5 justify-center mt-2'
export const DETAIL_THUMB = 'w-15 h-15 shrink-0 rounded-md'

// StatsHeader, SheetFab, and SheetSkeleton share these, so the skeleton cannot land a few pixels
// away from where the real header arrives.
export const SHEET_HEADER_ROW = 'flex items-center gap-4 p-4 bg-canvas'
export const SHEET_FAB_BOX = 'w-11 h-11'
export const SHEET_TITLE = 'text-lg font-semibold text-ink'

/**
 * The box at the foot of a sheet, empty until a screen claims it. A screen claims it with a
 * Portal, so its bottom bar travels in the same file as the rest of that screen.
 */
export const SheetFooterSlot = createContext<() => HTMLElement | undefined>(() => undefined)
export const useSheetFooter = () => useContext(SheetFooterSlot)
