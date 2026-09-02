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
