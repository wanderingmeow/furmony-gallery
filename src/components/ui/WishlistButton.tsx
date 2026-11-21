// src/components/ui/WishlistButton.tsx - the 收藏 button: the buzz, the flip, and the burst.
import { createSignal, type JSX } from "solid-js";
import type { AdoptListing } from "../../model/types";
import { tr } from "../../i18n";
import { isWishlisted, toggleWishlist } from "../../stores/wishlistStore";
import { useHaptic } from "../../hooks/useHaptic";
import { TAP_SLOP } from "./tapGate";
import { WishlistHeart } from "./WishlistHeart";

/** The card and the detail sheet show the same listing at once. Only the button the reader clicked
 *  counts the save, so the copy behind the sheet stays quiet. */
export function WishlistButton(props: {
  item: AdoptListing;
  /** The button's own box, which is the place the pointer lands on. */
  class?: string;
  classList?: Record<string, boolean>;
  /** The painted box inside it: a chip puts its color and shape here, so the press can shrink the
   *  paint without shrinking the box the reader is on. A plain icon needs none. */
  faceClass?: string;
  faceList?: Record<string, boolean>;
  /** The glyph's own classes: the chip colors it apart from its label. */
  heartClass?: string;
  size?: number;
  /** The card lies inside its own click target, so its click stops here. */
  stop?: boolean;
  children?: JSX.Element;
}) {
  const saved = () => isWishlisted(props.item.adoptId);
  const [savedHere, setSavedHere] = createSignal(0);
  // Where the finger came down, or null when the press came from the keyboard or from the switch
  // that buzzes: the click a label forwards to its control carries no coordinates, so the drift is
  // measured only between two points that both came from the finger.
  let down: { x: number; y: number } | null = null;
  let control!: HTMLButtonElement;

  return (
    <button
      // relative: the buzz label spreads over the nearest positioned box, which has to be this
      // button.
      ref={(el) => {
        control = el;
        useHaptic(el, saved);
      }}
      // pan-y: the buzz label inherits this, and a drag that starts on the heart belongs to the
      // page's scroll, not to the label.
      class={`relative flex touch-pan-y ${props.class ?? ""}`}
      classList={props.classList}
      onPointerDown={(e) => {
        down = { x: e.clientX, y: e.clientY };
        // A mouse press that walks off the heart would end as a click on the card around it, which
        // opens the detail page. The capture keeps the press here; the browser releases it with the
        // mouse. A finger is left alone, because the page's scroll takes that drag.
        if (e.pointerType !== "touch") control.setPointerCapture?.(e.pointerId);
      }}
      onPointerCancel={() => (down = null)}
      // The value is read before the flip: that is what tells a save from an unsave.
      onClick={(e) => {
        const fromFinger = e.clientX !== 0 || e.clientY !== 0;
        const travelled =
          down !== null &&
          fromFinger &&
          Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_SLOP;
        down = null;
        // The card is the reader's way to the detail page, and that holds for a press this button
        // refused: the click stops here either way.
        if (props.stop) e.stopPropagation();
        if (travelled) return;
        const goingIn = !saved();
        toggleWishlist(props.item);
        if (goingIn) setSavedHere((n) => n + 1);
      }}
      aria-label={props.children ? undefined : tr("card.wish")}
    >
      <span
        class={`press-face flex items-center ${props.faceClass ?? ""}`}
        classList={props.faceList}
      >
        <WishlistHeart
          on={saved()}
          savedHere={savedHere()}
          size={props.size}
          class={props.heartClass}
        />
        {props.children}
      </span>
    </button>
  );
}
