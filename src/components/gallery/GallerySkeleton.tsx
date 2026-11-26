// src/components/gallery/GallerySkeleton.tsx - the space the gallery takes while the first picture
// loads, including the strip of squares that will stand under it.
import { For, onMount, Show } from "solid-js";
import {
  ART_PLACEHOLDER,
  DETAIL_THUMB,
  DETAIL_THUMB_INNER,
  DETAIL_THUMB_ROW,
  SK_FILL,
} from "../ui/boxes";

export function GallerySkeleton(props: {
  thumbs: number;
  /** The tallest the first screen allows, since the card is as tall as its content. */
  maxH: number;
  /** How far the strip runs past the card's padding to the screen edge. */
  bleed: number;
  onHeight: (px: number) => void;
}) {
  let bar!: HTMLDivElement;
  onMount(() => props.onHeight(bar.offsetHeight));
  return (
    <div>
      <div
        ref={bar}
        class={`${SK_FILL} ${ART_PLACEHOLDER}`}
        style={{ height: `${props.maxH}px` }}
      />
      <Show when={props.thumbs > 0}>
        <div
          class={DETAIL_THUMB_ROW}
          style={{
            "margin-left": `${-props.bleed}px`,
            "margin-right": `${-props.bleed}px`,
            "padding-left": `${props.bleed}px`,
          }}
        >
          <div
            class={DETAIL_THUMB_INNER}
            style={{ "padding-right": `${props.bleed}px` }}
          >
            <For each={Array.from({ length: props.thumbs })}>
              {() => <div class={`${SK_FILL} ${DETAIL_THUMB}`} />}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
