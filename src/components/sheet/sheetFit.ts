import { SHEET_TAIL } from "../../draw/layout";

/** Stand the card as tall as the content it holds plus `SHEET_TAIL`, with the room the window leaves
 *  as its ceiling. The screen calls this once per listing, at the moment it knows its content is
 *  really on screen: what arrives later - a translation, a picture still decoding - scrolls inside
 *  that ceiling instead of moving the card.
 *
 *  The natural height is read with the card's own height let go. Both shapes stretch a column to
 *  whatever the card is - the panel's art column, a sheet's flex body - so asking them while the card
 *  is filled answers with the fill.
 */
export function fitSheetCard(el: Element | null): void {
  const card = el?.closest<HTMLElement>(".sheet-card");
  if (!card) return;
  const held = card.style.height;
  card.style.height = "auto";
  const natural = Math.round(card.getBoundingClientRect().height);
  card.style.height = held;
  if (natural > 0)
    card.style.setProperty(
      "--sheet-cap",
      `min(100%, ${natural + SHEET_TAIL}px)`,
    );
}
