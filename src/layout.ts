// src/layout.ts — card layout constants for the virtualized waterfall.
//
// Single source of truth for card geometry — components import THUMB_ASPECT from here
// (no local redefinition), so changing the image aspect ratio needs one edit.

// Thumbnail aspect ratio (921/597) — used for card height estimation
export const THUMB_ASPECT = 921 / 597

// Estimated text/extra height below the thumbnail in a card
// Real card height = cardWidth / THUMB_ASPECT + this. Measured via Playwright WebKit
// at several widths (186/326/280px card): actual ≈ cardWidth/THUMB_ASPECT + 87.62.
// The thumbnail is inset 24px horizontally, so the old +100 over-reserved by ~12.4px,
// making the vertical card gap bigger than the horizontal 16px gap.
// Keep it exact so rowHeight - cardHeight leaves a 16px vertical gap == horizontal gap.
export const CARD_EXTRA_HEIGHT = 87.62

// ---- waterfall geometry constants (single source) ----
// Card padding around the scroller content; horizontal card gap; min card width for the
// responsive column count; rows rendered beyond the visible window (overscan).
export const VIEW_PAD = 16
export const GAP = 16
export const MIN_CARD = 236
export const OVERSCAN_ROWS = 6

// Copyright footer band height under the last row
export const FOOTER_H = 72

// Row-preview chip: height, idle time before fade-out, and fade duration
export const PREVIEW_H = 36
export const PREVIEW_IDLE_MS = 700
export const FADE_MS = 400

// Scroll-position persistence throttle (ms) — saves the top visible id at most this often
export const SAVE_THROTTLE_MS = 2000
