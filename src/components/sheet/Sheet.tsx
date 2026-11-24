import { createEffect, createMemo, on, Show, type JSX } from "solid-js";
import { BACKDROP, BACKDROP_IN, BACKDROP_OUT, holdScroll } from "../ui/overlay";
import { CARD_BAND_PAD, SCROLL_BAND_PAD } from "../../draw/layout";
import { remeasureInsets } from "../ui/viewport";
import { SheetFooterSlot } from "../ui/boxes";
import { COL_SCROLLER, SCROLLER } from "./sheetScroll";
import { useSheetDrag } from "./useSheetDrag";
import { useSheetPresence } from "./useSheetPresence";
import {
  cardStyle,
  layerStyle,
  useSheetPose,
  type SheetPose,
} from "./sheetMotion";

// The sheet Detail and Stats share: it comes up from the bottom, and a drag down closes it once the
// content is at its top. `children` and `header` receive `dismiss`; `useSheetFooter` claims the foot.
export function Sheet(props: {
  open: () => boolean;
  onDismiss: () => void;
  // The header and the foot box sit outside the scroller, so nothing scrolls over them and a bar
  // never covers the scrollbar.
  header?: (dismiss: () => void) => JSX.Element;
  children: (dismiss: () => void) => JSX.Element;
}) {
  // props.open is usually `() => !!useMatch(...)`: a new id gives a new match object, so the boolean
  // stands still while the read marks the effects below dirty. This memo moves with the boolean only.
  const open = createMemo(() => props.open());
  const drag = useSheetDrag({
    getSheet: () => sheetEl,
    draggable: () => !shape.panel(),
    onDismiss: () => presence.dismiss(),
  });
  const shape = useSheetPose(drag);
  // The box that a screen's bottom bar travels into. It outlives one open: appending it on every
  // open moves it back into the sheet, and the bar inside it moves with it.
  const footerHost = document.createElement("div");
  let sheetEl: HTMLDivElement | null = null;

  // The innermost scroller, because in a panel the finger is on the right column.
  // The card pads the screen's bands into its own box, so it asks for them again as it rises.
  createEffect(on(open, (up) => up && remeasureInsets()));
  // eslint-disable-next-line solid/reactivity -- holdScroll tracks it inside its own effect
  holdScroll(
    open,
    () =>
      sheetEl?.querySelector<HTMLElement>(COL_SCROLLER) ??
      sheetEl?.querySelector<HTMLElement>(SCROLLER) ??
      null,
  );

  const presence = useSheetPresence({
    open,
    onDismiss: () => props.onDismiss(),
    moveMs: shape.moveMs,
    onEnter: () => {
      drag.dropGesture();
      drag.place(1);
      // Firefox folds the mount style and the target into one frame, and a rAF callback runs before
      // that frame's style is computed: the start value needs a frame of its own, layout read inside.
      requestAnimationFrame(() => {
        if (sheetEl) void sheetEl.offsetHeight;
        requestAnimationFrame(() => drag.place(0));
      });
    },
    // A sheet in mid-air keeps whatever branch the finger left it on.
    onLeave: () => {
      drag.place(1);
      drag.keepTransform();
    },
    onReturn: () => drag.place(0),
  });

  return (
    <Show when={presence.shown()}>
      <div class="fixed inset-0 z-[60]">
        <div
          data-sheet-backdrop=""
          class={`${BACKDROP} ${presence.closing() ? BACKDROP_OUT : BACKDROP_IN}`}
          // Only a mouse gets this. A finger cannot see where the panel ends behind its own pad,
          // and on the shortest screens there is no gap to aim at.
          onPointerUp={(e) => {
            if (shape.panel() && e.pointerType !== "touch") presence.dismiss();
          }}
        />
        <div
          ref={(el) => {
            sheetEl = el;
          }}
          class="absolute inset-0 flex items-center justify-center"
          style={layerStyle(shape.pose())}
        >
          <SheetCard
            pose={shape.pose()}
            closing={presence.closing()}
            footerHost={footerHost}
            bindScroller={drag.bindScroller}
            dismiss={presence.dismiss}
            header={props.header}
            children={props.children}
          />
        </div>
      </div>
    </Show>
  );
}

/** The box inside the layer. */
function SheetCard(props: {
  pose: SheetPose;
  closing: boolean;
  /** The box a screen's bottom bar travels into, owned by the sheet so it outlives one open. */
  footerHost: HTMLDivElement;
  bindScroller: (el: HTMLDivElement) => void;
  header?: (dismiss: () => void) => JSX.Element;
  children: (dismiss: () => void) => JSX.Element;
  dismiss: () => void;
}) {
  return (
    <div
      class={`sheet-card relative w-full h-full bg-canvas clip-no-scroll flex flex-col
        ${CARD_BAND_PAD} sm:max-w-190 sm:shadow-2xl`}
      data-sheet-gapped={props.pose.inset > 0 ? "" : undefined}
      style={cardStyle({ ...props.pose, closing: props.closing })}
    >
      {/* eslint-disable-next-line solid/reactivity -- the host is made once per sheet and never changes */}
      <SheetFooterSlot.Provider value={props.footerHost}>
        {props.header && (
          <div class="shrink-0">{props.header(props.dismiss)}</div>
        )}
        <div
          data-sheet-scroll=""
          ref={props.bindScroller}
          // overflow-y alone makes the other axis compute to auto, so a child sticking out by a
          // pixel would let the whole sheet slide sideways; only the related row moves sideways.
          // Scroll anchoring is off: rows above grow as they load, and on Safari anchoring also
          // undoes the scrollTop we write ourselves.
          style={{ "overflow-anchor": "none" }}
          // The bottom band only reaches this content when the card's bottom edge is the screen's,
          // which is where the gap is 0. A card standing in from the window edge is already clear.
          class={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${
            props.pose.inset > 0 ? "" : SCROLL_BAND_PAD
          }`}
        >
          {props.children(props.dismiss)}
        </div>
        <div
          class="shrink-0"
          data-sheet-footer=""
          ref={(el) => el.appendChild(props.footerHost)}
        />
      </SheetFooterSlot.Provider>
    </div>
  );
}
