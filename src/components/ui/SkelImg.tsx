import {
  createEffect,
  createSignal,
  on,
  onMount,
  splitProps,
  type JSX,
} from "solid-js";
import { onImageError } from "../../data/image";
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
 * The fill is the box's own background, and that is why the pulse is visible: the whole box
 * fades, border included. A fill layered over the box fades on its own while the border stays
 * still, and the animation is easy to miss.
 *
 * The picture has no fade-in. A transition that starts at opacity 0 runs on every visit, cached
 * or not, so a picture the browser already holds would fade for no reason.
 */
export function SkelImg(
  props: BoxProps & { url: string; box?: string; imgClass?: string },
) {
  const [own, rest] = splitProps(props, ["url", "box", "imgClass"]);
  const [filled, setFilled] = createSignal(false);
  let img!: HTMLImageElement;

  // A cached picture is already decoded, so the answer is here before the load event fires.
  // Without this check the box pulses for a frame behind a picture that is already on screen.
  onMount(() => {
    if (img.complete && img.naturalWidth > 0) setFilled(true);
  });
  // The element stays in place when the url changes, so the state from the previous picture has
  // to be cleared.
  createEffect(
    on(
      () => own.url,
      () => setFilled(false),
    ),
  );

  return (
    <div
      {...rest}
      class={`relative overflow-hidden ${own.box ?? ""} ${filled() ? "bg-surface-2" : SK_FILL}`}
    >
      <RemoteImg
        ref={(el) => (img = el)}
        src={own.url}
        loading="eager"
        decoding="async"
        class={`w-full h-full object-cover ${own.imgClass ?? ""}`}
        onLoad={() => setFilled(true)}
        onError={(e) => {
          const before = img.src;
          onImageError(e);
          // onImageError replaces src with a newer signed URL when it has one. With no newer URL
          // there is nothing left to wait for, so the box stops pulsing.
          if (img.src === before) setFilled(true);
        }}
      />
    </div>
  );
}
