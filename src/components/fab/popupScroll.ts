// A popup owns its own scrolling and nothing else. The list behind stays reachable: a gesture that
// starts outside the popup is the page's business, and one inside stops at the popup's own ends.

// A row can sit a fraction of a pixel short of its own end, so the last pixel reads as the end.
const AT_END = 1;

/** Whether a wheel over `from` moves something inside `box` that way. The nearest box that can
 *  scroll answers for the pointer: the panel behind it does not get a turn. */
export function scrollTakes(
  box: HTMLElement,
  from: EventTarget | null,
  delta: number,
): boolean {
  const start =
    from instanceof Element
      ? from
      : from instanceof Node
        ? from.parentElement
        : null;
  for (let el = start; el && box.contains(el); el = el.parentElement) {
    const room = el.scrollHeight - el.clientHeight;
    if (room <= 0) continue;
    return delta < 0 ? el.scrollTop > 0 : el.scrollTop < room - AT_END;
  }
  return false;
}

/** Whether a finger move, measured from where the touch started, answers for something inside `box`.
 *  A gesture that runs sideways needs no vertical scroll; a popup with nothing to scroll answers
 *  `false` for every vertical drag, which keeps a short panel from moving the list behind it. */
export function touchTakes(
  box: HTMLElement,
  from: EventTarget | null,
  dx: number,
  dy: number,
): boolean {
  if (Math.abs(dy) <= Math.abs(dx)) return true;
  return scrollTakes(box, from, -dy);
}
