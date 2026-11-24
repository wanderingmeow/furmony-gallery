// Where a popup hangs from the button it was opened by, and how tall the screen lets it stand.

// the near edge rests POPUP_GAP from the button; POPUP_AIR stays free at the far edge
export const POPUP_GAP = 8;
export const POPUP_AIR = 8;

export type PopupPlace = {
  side: "top" | "bottom";
  /** The distance from the edge named by `side`. */
  at: number;
  right: number;
  room: number;
};

/** The button's rect and the two heights a placement reads: `h` is the viewport the box is fixed to,
 *  and `steady` the height that holds while the browser's own bar folds away. */
export type PopupView = { w: number; h: number; steady: number };

export function place(
  r: { top: number; bottom: number; right: number },
  view: PopupView,
  drop?: boolean,
): PopupPlace {
  const right = view.w - r.right;
  const air = POPUP_GAP + POPUP_AIR;
  return drop
    ? {
        side: "top",
        at: r.bottom + POPUP_GAP,
        right,
        room: view.steady - r.bottom - air,
      }
    : {
        side: "bottom",
        at: view.h - r.top + POPUP_GAP,
        right,
        room: r.top - air,
      };
}
