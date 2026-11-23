// Where the arrow keys take the selection in the waterfall, and what the document scrolls to keep
// the chosen card in sight. Both rules are arithmetic on the grid the layout already builds, so they
// are testable without a DOM; the wiring lives in components/cards/Waterfall.tsx.

export type CardMove = "up" | "down" | "left" | "right";

/**
 * The card next to `index` in a grid of `cols` columns over `count` cards, or null where the list has
 * no card there. One row is one column's worth of cards away, one column is one card away.
 *
 * A row is a line rather than a path that wraps: the card left of a row's first is nowhere, not the
 * last card of the row above. A ragged last row needs no case of its own - a column it never reached
 * simply has nothing below it.
 */
export function cardNeighbor(
  index: number,
  cols: number,
  count: number,
  move: CardMove,
): number | null {
  const to =
    move === "down"
      ? index + cols
      : move === "up"
        ? index - cols
        : move === "right"
          ? index + 1
          : index - 1;
  if (to < 0 || to >= count) return null;
  const col = index % cols;
  if (move === "left" && col === 0) return null;
  if (move === "right" && col === cols - 1) return null;
  return to;
}

/**
 * The scroll that keeps a card's row whole on screen: below the band the list reserves above it and
 * above the reserve the pill keeps below. A row already whole is left where it stands, so walking the
 * grid does not jog the page. The browser's own scroll-on-focus aligns an element to the viewport
 * edge, which is under the band.
 */
export function scrollForCard(opts: {
  rowTop: number;
  rowHeight: number;
  scrollY: number;
  viewport: number;
  topPad: number;
  bottomPad: number;
}): number {
  const { rowTop, rowHeight, scrollY, viewport, topPad, bottomPad } = opts;
  if (rowTop < scrollY + topPad) return Math.max(0, rowTop - topPad);
  const bottom = rowTop + rowHeight - viewport + bottomPad;
  return bottom > scrollY ? bottom : scrollY;
}
