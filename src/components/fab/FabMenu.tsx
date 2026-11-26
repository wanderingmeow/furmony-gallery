// The panel opens away from the edge the button stands on, takes the room that direction has, and
// stops short of the far edge. It is portalled to <body>: the waterfall sits in a fixed layer, and a
// second .glass inside that layer is clipped by it, so the blur would never paint.
import {
  createEffect,
  createSignal,
  on,
  onCleanup,
  Show,
  type JSX,
} from "solid-js";
import { Portal } from "solid-js/web";
import type { IconDefinition } from "@ant-design/icons-svg/lib/types";
import { AntIcon } from "../ui/AntIcon";
import { steadyViewportH } from "../ui/viewport";
import { FAB_SIZE, FabCircle } from "./FabCircle";
import { place, type PopupPlace } from "./popupPlace";
import { scrollTakes, touchTakes } from "./popupScroll";

// The count sits on the button's edge, on the 45° line to the top-right corner.
const EDGE = (FAB_SIZE / 2) * Math.SQRT1_2;

// The centre is pinned rather than the box's corner: `-50%` is the pill's own half-size, so a
// two-digit count grows along the edge instead of sliding off it.
const ON_EDGE: JSX.CSSProperties = {
  left: "50%",
  top: "50%",
  transform: `translate(calc(-50% + ${EDGE}px), calc(-50% - ${EDGE}px))`,
};

/** The box is the chrome and the height the screen allows; the panel inside owns the padding and the
 *  scrolling, so the content reaches the glass edge.
 *  Portalled to the body, so its level is the page's own: 40 the chrome it hangs from, 45 the
 *  back-to-top circle, 46 a box the user is working inside, 60 a sheet, 70 a dialog. */
const POPUP_BOX = `fixed z-[46] glass rounded-xl shadow-xl border border-black/10
                   clip-no-scroll flex flex-col`;

export function FabMenu(props: {
  label: string;
  icon: IconDefinition | (() => IconDefinition);
  /** Replaces the glyph when it returns an element. Returning null falls back to `icon`. */
  face?: () => JSX.Element | null;
  /** The number on the corner button. It has to be readable with the panel shut. */
  badge?: () => number;
  /** Hang the panel below the button instead of above it. */
  drop?: boolean;
  panelClass?: string;
  children?: JSX.Element;
}) {
  const [open, setOpen] = createSignal(false);
  const badge = () => props.badge?.() ?? 0;

  let wrap!: HTMLDivElement;
  let popup!: HTMLDivElement;
  const [pos, setPos] = createSignal<PopupPlace | null>(null);

  createEffect(
    on(open, (shown) => {
      if (!shown) {
        setPos(null);
        return;
      }
      const measure = () =>
        setPos(
          place(
            wrap.getBoundingClientRect(),
            {
              w: window.innerWidth,
              h: window.innerHeight,
              steady: steadyViewportH(),
            },
            props.drop,
          ),
        );
      measure();
      // The circle stands in the band fixed to the top of the window, so nothing the page does moves
      // it. The window's own height does, as Safari folds its bar away, and re-reading that while the
      // box hangs open slides the box under the finger.
      const wide = window.innerWidth;
      const onResize = () => {
        if (window.innerWidth !== wide) measure();
      };
      window.addEventListener("resize", onResize);
      onCleanup(() => window.removeEventListener("resize", onResize));
    }),
  );

  // While the panel is open it owns the input. The click listener runs in the capture phase, because
  // a card's own click calls stopPropagation and a tap on anything else would never reach the
  // bubble phase.
  createEffect(
    on(open, (shown) => {
      if (!shown) return;
      const onClick = (e: MouseEvent) => {
        const t = e.target as Node;
        if (wrap.contains(t) || popup.contains(t)) return;
        setOpen(false);
      };
      // Escape belongs to the panel while it is up: stopping here keeps the band behind from
      // reading the same key as a request to leave picture mode.
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        setOpen(false);
      };
      // Inside the panel the panel answers: past either end of its own list the list behind keeps its
      // place. Outside it the page scrolls as it pleases - this is a corner popup, not a modal.
      const owns = (t: EventTarget | null) =>
        !!popup && t instanceof Node && popup.contains(t);
      const onWheel = (e: WheelEvent) => {
        if (owns(e.target) && !scrollTakes(popup, e.target, e.deltaY))
          e.preventDefault();
      };
      // A finger is measured from where it landed. The document's touch listeners are passive by
      // default, so the one that may stop the page has to say otherwise.
      let startX = 0;
      let startY = 0;
      const onTouchStart = (e: TouchEvent) => {
        startX = e.touches[0]?.clientX ?? 0;
        startY = e.touches[0]?.clientY ?? 0;
      };
      const onTouchMove = (e: TouchEvent) => {
        const t = e.touches[0];
        if (!e.cancelable || !t || e.touches.length !== 1 || !owns(e.target))
          return;
        if (
          !touchTakes(popup, e.target, t.clientX - startX, t.clientY - startY)
        )
          e.preventDefault();
      };
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKey);
      document.addEventListener("wheel", onWheel, {
        passive: false,
        capture: true,
      });
      document.addEventListener("touchstart", onTouchStart, { passive: true });
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      onCleanup(() => {
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("wheel", onWheel, { capture: true });
        document.removeEventListener("touchstart", onTouchStart);
        document.removeEventListener("touchmove", onTouchMove);
      });
    }),
  );

  return (
    <div class="relative" ref={wrap}>
      <FabCircle
        title={props.label}
        expanded={open()}
        accent={open}
        onClick={() => setOpen((o) => !o)}
      >
        {props.face?.() ?? <AntIcon icon={props.icon} size={22} />}
        <Show when={badge() > 0}>
          {/* The same orange as the fill, so the number and the button mean one thing. The ring
              takes the circle's own colour, so the number stays cut out when the button is orange
              too. */}
          <span
            style={ON_EDGE}
            class="absolute min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[9px] font-bold
                   flex items-center justify-center border border-surface"
          >
            {badge()}
          </span>
        </Show>
      </FabCircle>

      <Show when={open() && pos()}>
        <Portal>
          <div
            ref={popup}
            class={`${POPUP_BOX} ${props.panelClass ?? ""}`}
            style={{
              [pos()!.side]: `${pos()!.at}px`,
              right: `${pos()!.right}px`,
              "max-height": `${pos()!.room}px`,
            }}
          >
            {props.children}
          </div>
        </Portal>
      </Show>
    </div>
  );
}
