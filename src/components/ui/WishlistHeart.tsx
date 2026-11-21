import { createEffect, createSignal, For, on, onCleanup, Show } from "solid-js";
import { HeartFilled, HeartOutlined } from "@ant-design/icons-svg";
import { AntIcon } from "./AntIcon";

const SPARKS = Array.from({ length: 6 }, (_, i) => ({
  theta: `${(i / 6) * 360}deg`,
  color: [
    "var(--color-red-400)",
    "var(--color-red-500)",
    "var(--color-red-600)",
  ][i % 3],
}));

// How long the longest animation in WishlistHeart.css runs.
const HEART_POP_MS = 620;

/** The wishlist glyph. One rise of `savedHere` plays one burst, and `WishlistButton` counts a save
 *  only for the button the reader clicked. */
export function WishlistHeart(props: {
  on: boolean;
  savedHere: number;
  size?: string | number;
  class?: string;
}) {
  const [pop, setPop] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  createEffect(
    on(
      () => props.savedHere,
      () => {
        clearTimeout(timer);
        // A second burst needs one frame with the first one out of the tree.
        setPop(false);
        requestAnimationFrame(() => setPop(true));
        timer = setTimeout(() => setPop(false), HEART_POP_MS);
      },
      { defer: true },
    ),
  );

  onCleanup(() => clearTimeout(timer));

  return (
    <span class={`relative flex ${props.class ?? ""}`}>
      <span classList={{ "heart-pop": pop() }} class="flex">
        <AntIcon
          icon={props.on ? HeartFilled : HeartOutlined}
          size={props.size}
        />
      </span>
      <Show when={pop()}>
        {/* The burst measures itself in em, so this is the heart's own size. */}
        <span
          class="heart-burst"
          aria-hidden="true"
          style={{
            "font-size":
              props.size === undefined ? undefined : `${props.size}px`,
          }}
        >
          <span class="heart-ripple" />
          <For each={SPARKS}>
            {(s) => (
              <span
                class="heart-spark"
                style={{ "--theta": s.theta, "background-color": s.color }}
              />
            )}
          </For>
        </span>
      </Show>
    </span>
  );
}
