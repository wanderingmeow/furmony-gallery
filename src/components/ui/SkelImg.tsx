import {
  createEffect,
  createSignal,
  on,
  onMount,
  Show,
  splitProps,
  type JSX,
} from "solid-js";
import { onImageError } from "../../data/image";
import type { XGallery } from "../../stores/xReachStore";
import { BrokenMark } from "./BrokenMark";
import { SK_FILL } from "./boxes";
import { RemoteImg } from "./RemoteImg";

type BoxProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "class">;

/**
 * A picture with the skeleton fill behind it. The fill shows while the picture has no pixels,
 * and the picture covers it once they arrive.
 *
 * Extra props go on the box, so a caller can add a border, a click handler, or a background of
 * its own. The classes for the box go in `box`, because the component sets `class` itself.
 *
 * The fill is the box's own background, so the whole box pulses, border included.
 *
 * The picture has no fade-in: a transition that starts at opacity 0 runs on every visit, cached
 * or not, so a picture the browser already holds would fade for no reason.
 */
export function SkelImg(
  props: BoxProps & {
    url: string;
    box?: string;
    imgClass?: string;
    /** What one detail sheet concluded about X. A picture from X reports what happens to it, and
     *  the sheet's conclusion then covers every picture the sheet holds. */
    gallery?: XGallery;
  },
) {
  const [own, rest] = splitProps(props, ["url", "box", "imgClass", "gallery"]);
  const [filled, setFilled] = createSignal(false);
  const [broken, setBroken] = createSignal(false);
  let img!: HTMLImageElement;

  // A cached picture is decoded before the load event fires, so the answer can be here already.
  // Going into the document is the sheet asking, so one not drawn yet starts its clock.
  onMount(() => {
    if (img.complete && img.naturalWidth > 0) {
      setFilled(true);
      own.gallery?.arrived(own.url);
    } else {
      own.gallery?.watched(own.url);
    }
  });
  // The element stays in place when the url changes, so the state from the previous picture has
  // to be cleared.
  createEffect(
    on(
      () => own.url,
      () => {
        setFilled(false);
        setBroken(false);
      },
    ),
  );
  // A sheet that concluded something about X says the same about every picture it holds, and its
  // words win over one picture's own failure, because they name the host.
  const stopped = () => own.gallery?.blocked(own.url);
  const marked = () => broken() || stopped() !== undefined;

  return (
    <div
      {...rest}
      class={`relative overflow-hidden ${own.box ?? ""} ${
        filled() || marked() ? "bg-surface-2" : SK_FILL
      }`}
    >
      <RemoteImg
        ref={(el) => (img = el)}
        src={own.url}
        loading="eager"
        decoding="async"
        // A browser paints its own torn-picture glyph in the corner of an image that failed, so a
        // failed picture leaves the drawing entirely and the mark sits alone.
        class={`w-full h-full object-cover ${own.imgClass ?? ""} ${marked() ? "invisible" : ""}`}
        onLoad={() => {
          setFilled(true);
          own.gallery?.arrived(own.url);
        }}
        onError={(e) => {
          const before = img.src;
          onImageError(e);
          // onImageError swaps in a newer signed address when there is one. With none left to try
          // the failure is final: the box stops pulsing and the sheet hears it.
          if (img.src === before) {
            setFilled(true);
            setBroken(true);
            own.gallery?.refused(own.url);
          }
        }}
      />
      {/* The mark lies over the box, where the pixels would be: one in the flow would sit below a
          picture that still holds the box. */}
      <Show when={marked()}>
        <span class="absolute inset-0">
          <BrokenMark why={stopped()} />
        </span>
      </Show>
    </div>
  );
}
