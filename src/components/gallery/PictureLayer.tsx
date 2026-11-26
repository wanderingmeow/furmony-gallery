import type { JSX } from "solid-js";
import { Dynamic } from "solid-js/web";

/** The pace a layer over the picture arrives and leaves at. */
export const PICTURE_FADE_MS = 200;

/** How long the dim takes to arrive. A picture already in memory answers inside a frame, so the dim
 *  is never in the way, and the spinner waits behind it. */
export const DIM_MS = 160;

/** What a layer does with a tap while it is up. */
export type LayerTap =
  /** The tap leaves the page. */
  | { href: string }
  /** The tap is answered here. */
  | { pick: () => void }
  /** The layer's own content answers it: a player, a control inside the layer. */
  | "itself"
  /** The layer takes the tap and sends it nowhere: the picture under it is not there to reach. */
  | "nowhere"
  /** The layer takes nothing, and the picture underneath answers. The dim over a picture on its way
   *  is drawn to be seen through. */
  | "through";

/**
 * One layer over the gallery's picture: the picture's own box, the same inset, corners and pace. It
 * is laid over the picture because the picture is what holds the box's height, and a layer that took
 * the box away would take the shape of the row with it. A layer that is not up takes no tap, so a
 * fade out is a fade out and not a wall the user clicks into while it is still see-through.
 */
export function PictureLayer(props: {
  /** The layer is drawn, and takes the taps `taps` gives it. */
  up: boolean;
  taps?: LayerTap;
  /** How long arriving and leaving takes, where the caller is not on the picture's pace. */
  ms?: number;
  /** What the layer stands on: the picture's own surface by default. */
  class?: string;
  /** What the layer says to a user who cannot see it. */
  label?: string;
  /** The layer has nothing for a user who cannot see it. */
  hidden?: boolean;
  children?: JSX.Element;
}): JSX.Element {
  const taps = (): LayerTap => props.taps ?? "through";
  // Each shape is read once, so the element and the props it is drawn with come from one answer.
  const href = (): string | undefined => {
    const t = taps();
    return typeof t === "object" && "href" in t ? t.href : undefined;
  };
  const pick = (): (() => void) | undefined => {
    const t = taps();
    return typeof t === "object" && "pick" in t ? t.pick : undefined;
  };
  const drawn = () => props.up && taps() !== "through";
  return (
    <Dynamic
      component={href() ? "a" : pick() ? "button" : "div"}
      class={`absolute inset-0 overflow-hidden rounded-xl ease-out transition-opacity ${props.class ?? ""}`}
      style={{
        opacity: props.up ? 1 : 0,
        "transition-duration": `${props.ms ?? PICTURE_FADE_MS}ms`,
        "pointer-events": drawn() ? "auto" : "none",
      }}
      {...(href()
        ? { href: href(), target: "_blank", rel: "noopener noreferrer" }
        : pick()
          ? { type: "button", onClick: pick() }
          : {})}
      aria-label={props.label}
      aria-hidden={props.hidden ? true : undefined}
    >
      {props.children}
    </Dynamic>
  );
}
