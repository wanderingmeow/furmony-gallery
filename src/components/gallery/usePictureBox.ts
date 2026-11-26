// src/components/gallery/usePictureBox.ts - the shape of the picture box, and the resize that
// redoes it.
import {
  createEffect,
  createSignal,
  on,
  onCleanup,
  untrack,
  type Accessor,
} from "solid-js";
import { watchSize } from "../ui/viewport";
import { heightStyle, moveStyle, fittedHeight } from "./picHeight";

// A debut clip is shot standing up, so the box opens to this shape while it plays.
const PORTRAIT_VIDEO = 16 / 9;

export function usePictureBox(box: {
  /** The square the user is on is the clip's own. */
  atClip: Accessor<boolean>;
  /** The picture on screen. */
  shown: Accessor<string>;
  /** The square the user is on. */
  current: Accessor<string>;
  /** The tallest a still may stand. */
  cap: Accessor<number>;
  /** Stand at the height the screen gives, whatever the shape of the picture. */
  holdHeight: Accessor<boolean>;
  /** The height a clip is played at, above the one a still is given. */
  clipMaxH: Accessor<number | undefined>;
  /** The flow has left the skeleton, so there are pixels to redo. */
  settled: Accessor<boolean>;
  /** The height the skeleton stood the box at. */
  skeleton: Accessor<number>;
  /** The card around the box is as tall as the picture. */
  onHeightChange?: () => void;
}) {
  const [height, setHeight] = createSignal(0);
  const [width, setWidth] = createSignal(0);
  let wrapperEl!: HTMLDivElement;
  let picEl!: HTMLImageElement;

  const fit = (pic: { naturalWidth: number; naturalHeight: number }): number =>
    fittedHeight(
      pic,
      wrapperEl ? wrapperEl.clientWidth : 0,
      box.cap(),
      box.holdHeight(),
    );

  // Bilibili draws its cover across, so the tall frame is kept until the picture asked for is the
  // picture on screen: handing it back when the square is left drops the box to the cover's shape
  // mid-switch.
  const [frameHeld, setFrameHeld] = createSignal(false);
  createEffect(
    on([box.atClip, box.shown, box.current], ([isClip, drawn, wanted]) => {
      if (isClip) {
        setFrameHeld(true);
        return;
      }
      if (drawn && drawn === wanted) setFrameHeld(false);
    }),
  );
  const tall = () => box.atClip() || frameHeld();
  const ceiling = () =>
    tall() && !box.holdHeight() ? (box.clipMaxH() ?? box.cap()) : box.cap();
  const frameHeight = () => {
    if (!tall() || box.holdHeight() || width() <= 0) return undefined;
    return `${Math.min(Math.round(width() * PORTRAIT_VIDEO), ceiling())}px`;
  };

  const picBox = () => ({
    height:
      frameHeight() ??
      heightStyle({
        held: box.holdHeight(),
        cap: box.cap(),
        measured: height(),
        skeleton: box.skeleton(),
      }),
    "max-height": `${ceiling()}px`,
  });
  const picMove = () => moveStyle({ held: box.holdHeight(), eased: eased() });

  // A refit lands in the same frame, because the card measures against it right after.
  const [eased, setEased] = createSignal(true);
  const refit = () => {
    if (wrapperEl) setWidth(wrapperEl.clientWidth);
    if (!untrack(box.settled) || !picEl) return;
    const h = fit(picEl);
    // The same height is not a change: skipping it leaves the easing and the card around it alone.
    if (h <= 0 || h === height()) return;
    setEased(false);
    setHeight(h);
    requestAnimationFrame(() => setEased(true));
  };

  let stopWidth: (() => void) | undefined;
  const watchWidth = (el: HTMLDivElement) => {
    wrapperEl = el;
    setWidth(el.clientWidth);
    stopWidth = watchSize(el, refit);
  };
  const watchPic = (el: HTMLImageElement) => (picEl = el);
  onCleanup(() => stopWidth?.());
  createEffect(on(box.cap, refit));

  // The card measures the first height itself, hence `defer: true`.
  const report = (): void => {
    const stood = box.holdHeight() ? box.cap() : height();
    if (stood > 0) box.onHeightChange?.();
  };
  createEffect(on([height, box.cap], report, { defer: true }));

  return {
    height,
    raise: setHeight,
    fit,
    watchWidth,
    watchPic,
    tall,
    ceiling,
    picBox,
    picMove,
  };
}
