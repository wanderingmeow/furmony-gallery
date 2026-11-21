// The panel opens away from the edge the button stands on, takes the room that direction has, and
// stops short of the far edge.
//
// The panel is portalled to <body>. The waterfall sits in a fixed layer, and a second .glass inside
// that layer is clipped by it, so the blur would never paint.
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
import { FAB_SIZE, FabCircle } from "./FabCircle";

// The count sits on the button's edge, on the 45° line to the top-right corner.
const EDGE = (FAB_SIZE / 2) * Math.SQRT1_2;

// The centre is pinned rather than the box's corner: `-50%` is the pill's own half-size, so a
// two-digit count grows along the edge instead of sliding off it.
const ON_EDGE: JSX.CSSProperties = {
  left: "50%",
  top: "50%",
  transform: `translate(calc(-50% + ${EDGE}px), calc(-50% - ${EDGE}px))`,
};

// the near edge rests POPUP_GAP from the button; POPUP_AIR stays free at the far edge
const POPUP_GAP = 8;
const POPUP_AIR = 8;

/** The box is the chrome and the height the screen allows. The panel inside owns the padding and
 *  the scrolling, so the content reaches the glass edge. */
const POPUP_BOX = `fixed z-40 glass rounded-xl shadow-xl border border-black/10
                   clip-no-scroll flex flex-col`;

// A row can sit a fraction of a pixel short of its own end, so the last pixel reads as the end.
const AT_END = 1;

/** Whether a wheel over `from` moves something inside `box` that way. The nearest box that can
 *  scroll answers for the pointer: the panel behind it does not get a turn. */
function scrollTakes(
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
  type Placement = {
    side: "top" | "bottom";
    at: number;
    right: number;
    room: number;
  };
  const [pos, setPos] = createSignal<Placement | null>(null);

  createEffect(
    on(open, (shown) => {
      if (!shown) {
        setPos(null);
        return;
      }
      // portalled to <body>, so it shares no box with the circle: every scroll and resize reads it again
      const measure = () => {
        const r = wrap.getBoundingClientRect();
        const right = window.innerWidth - r.right;
        setPos(
          props.drop
            ? {
                side: "top",
                at: r.bottom + POPUP_GAP,
                right,
                room: window.innerHeight - r.bottom - (POPUP_GAP + POPUP_AIR),
              }
            : {
                side: "bottom",
                at: window.innerHeight - r.top + POPUP_GAP,
                right,
                room: r.top - (POPUP_GAP + POPUP_AIR),
              },
        );
      };
      measure();
      window.addEventListener("resize", measure);
      window.addEventListener("scroll", measure, true);
      onCleanup(() => {
        window.removeEventListener("resize", measure);
        window.removeEventListener("scroll", measure, true);
      });
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
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      // The list behind stays where it is, whether the pointer sits over the glass, over the rest of
      // the screen, or past either end of the panel's own list.
      const onWheel = (e: WheelEvent) => {
        if (!scrollTakes(popup, e.target, e.deltaY)) e.preventDefault();
      };
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKey);
      document.addEventListener("wheel", onWheel, {
        passive: false,
        capture: true,
      });
      onCleanup(() => {
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("wheel", onWheel, { capture: true });
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
