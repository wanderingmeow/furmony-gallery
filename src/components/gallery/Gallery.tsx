import {
  createEffect,
  createMemo,
  createSignal,
  Match,
  on,
  Show,
  Switch,
  untrack,
} from "solid-js";
import { tr } from "../../i18n";
import { RemoteImg } from "../ui/RemoteImg";
import { imageReady, onImageError } from "../../data/image";
import type { DebutVideo } from "../../data/debuts";
import type { ClipSlot, GallerySlot } from "./slots";
import { BrokenMark } from "../ui/BrokenMark";
import { DIM_MS, PictureLayer, PICTURE_FADE_MS } from "./PictureLayer";
import { ART_PLACEHOLDER } from "../ui/boxes";
import { createGalleryFlow, type ArtBox } from "./galleryFlow";
import { ClipLayer, createClipPlayer } from "./GalleryClip";
import { GallerySkeleton } from "./GallerySkeleton";
import { GalleryStrip } from "./GalleryStrip";
import { usePictureMark } from "./usePictureMark";
import { usePictureBox } from "./usePictureBox";

export function Gallery(props: {
  /** The squares in the order a user swipes them, with the clip's own square standing among them.
   *  See `slots.ts` for what that square costs and why it is not asked for up front. */
  slots: GallerySlot[];
  index: () => number;
  setIndex: (i: number) => void;
  onOpenFull: () => void;
  /** The tallest picture this may take. Detail passes what the screen leaves; DEFAULT_MAX_H is the
   *  ceiling for a caller that does not. */
  maxH?: number;
  /** Stand at the height the screen gives, whatever the shape of the picture. A switch then keeps
   *  the height of the card around this where it is. */
  holdHeight?: boolean;
  /** The picture settled at a different height, so the card around it has to measure again. */
  onPicHeightChange?: () => void;
  /** How far the strip runs past the card's padding to the screen edge. */
  bleed?: () => number;
  /** The height the clip is played at. It is taller than the height a still is allowed to stand at,
   *  because a clip is watched and the table under it can wait below the fold. */
  clipMaxH?: number;
}) {
  const count = () => props.slots.length;
  const slot = () => props.slots[Math.min(props.index(), count() - 1)];
  const clipSlot = (): ClipSlot | undefined => {
    const one = slot();
    return one?.kind === "clip" ? one : undefined;
  };
  const atClip = () => clipSlot() !== undefined;
  // This listing's clip wherever its square stands.
  const listingClip = (): DebutVideo | undefined => {
    for (const one of props.slots) if (one.kind === "clip") return one.clip;
  };
  // The clip's square is no exception: what its box shows is the cover Bilibili drew.
  const current = (): string => slot()?.url ?? "";

  const clip = createClipPlayer({
    atClip,
    index: () => props.index(),
    first: () => props.slots[0]?.url,
    bv: () => listingClip()?.bv,
    cover: () => props.slots.find((one) => one.kind === "clip")?.url,
  });
  const playing = clip.playing;

  // The square of the picture already on screen asks too: the index does not move, and a clip left
  // running would play on over the picture the user just swiped to.
  const show = (at: number): void => {
    clip.stop();
    props.setIndex(at);
  };
  // The clip's box is already as big as it gets, so tapping it asks for the player.
  const tapped = (): void => (atClip() ? clip.start() : props.onOpenFull());
  // The clip's square is its place in the list and its switch at once.
  const ask = (at: number): void => {
    if (at === props.index()) {
      clip.toggle();
      return;
    }
    show(at);
    clip.start();
  };

  const bleed = () => props.bleed?.() ?? 0;

  const DEFAULT_MAX_H = 400;
  const cap = () => props.maxH ?? DEFAULT_MAX_H;
  let skeletonH = 0;

  // The read is for the first picture only, so `untrack` keeps it from subscribing: the layers
  // below follow the index.
  const readyNow = untrack(() => !!current() && imageReady(current()));

  // Only the flow writes the picture on screen, so a switch never shows a blank frame.
  const [shown, setShown] = createSignal(untrack(current));
  // A picture can show once its own element reports the load, so this waits on the element.
  const [drawn, setDrawn] = createSignal(readyNow);
  const mark = usePictureMark({ current, shown });

  // The flow says whether the box has pixels to redo a height from.
  const [settled, setSettled] = createSignal(readyNow || count() === 0);
  const pic = usePictureBox({
    atClip,
    shown,
    current,
    cap,
    holdHeight: () => !!props.holdHeight,
    clipMaxH: () => props.clipMaxH,
    settled,
    skeleton: () => skeletonH,
    onHeightChange: () => props.onPicHeightChange?.(),
  });

  // Everything a switch may write, in one object: the flow holds this and nothing else of the box.
  const art: ArtBox = {
    shown,
    show: setShown,
    height: pic.height,
    raise: pic.raise,
    fit: pic.fit,
  };
  const flow = createGalleryFlow({ ...art, current, readyNow, count: count() });
  createEffect(on(flow, (state) => setSettled(state.type !== "skeleton")));

  // A mark ends the switch it covers: the box settles on the square the user asked for, so the
  // next switch does not crossfade out of the picture they left behind.
  createEffect(
    on(mark.marked, (up) => {
      if (!up) return;
      const state = flow();
      const src = current();
      if (!src || state.type === "still") return;
      state.to.still({ src, h: 0 });
    }),
  );

  // One element across both states, so the fade has a 0 to start from.
  const overlay = createMemo(() => {
    const state = flow();
    if (state.type === "loading")
      return { src: state.value.src(), ready: false };
    if (state.type === "fading") return { src: state.value.src, ready: true };
    return null;
  });

  // The dim belongs to the wait, so it goes down as soon as the box has a mark to show.
  const dimmed = () => flow().type === "loading" && !mark.marked();
  const waiting = () => {
    const state = flow();
    return state.type === "loading" && state.value.spinner();
  };

  return (
    <Switch fallback={<div class={`bg-surface-2 ${ART_PLACEHOLDER}`} />}>
      <Match when={flow().type === "skeleton"}>
        <GallerySkeleton
          thumbs={props.slots.length}
          maxH={cap()}
          bleed={bleed()}
          onHeight={(px) => (skeletonH = px)}
        />
      </Match>
      <Match when={count() > 0}>
        <div>
          <div class="relative" ref={pic.watchWidth}>
            <Show when={shown()}>
              <RemoteImg
                src={shown()}
                ref={pic.watchPic}
                class="w-full object-contain rounded-xl bg-surface"
                style={{
                  ...pic.picBox(),
                  transition: pic.picMove(),
                  // A marked box lets its picture fade at the pace the mark arrives, so the two
                  // cross. Unpainted pixels cannot show a browser's own broken-picture glyph.
                  opacity: drawn() && !mark.marked() ? 1 : 0,
                }}
                onTransitionEnd={(e) => {
                  // The card stands to this height, so a switch that changed it has to be reported.
                  if (e.propertyName === "height") props.onPicHeightChange?.();
                }}
                onClick={() => tapped()}
                onLoad={(e) => {
                  setDrawn(true);
                  pic.raise(pic.fit(e.currentTarget));
                  mark.arrived(e.currentTarget.src);
                }}
                onError={(e) => {
                  setDrawn(true); // a broken picture still fades in
                  onImageError(e);
                  // A newer signed address means there is something left to wait for.
                  if (e.currentTarget.src === shown()) mark.failed(shown());
                }}
              />
            </Show>
            {/* A browser checks its protection list against the content a sheet loads, and a tap
                to another site is a different request, so a picture the browser refused to ask for
                is still worth a link the user asks for. A network that carries nothing answers a
                tap the way it answers a request, so that one gets no link. */}
            <PictureLayer
              up={mark.marked()}
              taps={mark.said() === "refused" ? { href: current() } : "nowhere"}
              label={
                mark.said() === "refused" ? tr("detail.openPicture") : undefined
              }
              class="bg-surface"
              hidden={!mark.marked()}
            >
              <BrokenMark size="2.5rem" withReason why={mark.said()} />
            </PictureLayer>
            <Show when={overlay()}>
              {(next) => (
                <PictureLayer
                  up={next().ready}
                  taps={{ pick: () => tapped() }}
                  class="bg-surface"
                  hidden
                >
                  <RemoteImg
                    src={next().src}
                    class="w-full h-full object-contain"
                    onError={onImageError}
                  />
                </PictureLayer>
              )}
            </Show>
            {/* The dim leaves at the pace of the picture that replaces it, so the two cross. The
                spinner waits the dim out, so a picture that arrives first never shows one. */}
            <PictureLayer
              up={dimmed()}
              ms={dimmed() ? DIM_MS : PICTURE_FADE_MS}
              class="no-pick flex items-center justify-center bg-white/60 dark:bg-black/40"
              hidden
            >
              <div
                class="spinner w-6 h-6 ease-out transition-opacity"
                style={{
                  opacity: waiting() ? 1 : 0,
                  "transition-duration": `${dimmed() ? DIM_MS : PICTURE_FADE_MS}ms`,
                }}
              />
            </PictureLayer>
            <Show when={clipSlot()}>
              {(one) => (
                <ClipLayer
                  bv={one().clip.bv}
                  playing={playing()}
                  frameUp={clip.frameUp()}
                  arrive={clip.arrive}
                  onStart={clip.start}
                />
              )}
            </Show>
          </div>
          <div class="relative h-0">
            {/* The counter floats over the swipe surface, so a held thumb lands on it. `role=status`
                is what makes a screen reader speak the line again when the page turns. */}
            <span
              class="no-pick absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-0.5 rounded-md bg-black/50 text-white text-[11px]"
              role="status"
            >
              <span class="sr-only">
                {tr("detail.positionOf", props.index() + 1, count())}
              </span>
              <span aria-hidden="true">
                {props.index() + 1} / {count()}
              </span>
            </span>
          </div>
          <GalleryStrip
            slots={props.slots}
            index={() => props.index()}
            playing={playing}
            gallery={mark.gallery}
            onShow={show}
            onAsk={ask}
            bleed={bleed}
          />
        </div>
      </Match>
    </Switch>
  );
}
