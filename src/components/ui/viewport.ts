import {
  type Accessor,
  createMemo,
  createRoot,
  createSignal,
  onCleanup,
} from "solid-js";
import type { Insets } from "../../draw/layout";

// `env()` becomes a length only once it reaches a property that takes one, so each band is read off
// a box whose own width or height is its --safe-* name. A box keeps only the last name it was
// given, so each band gets a box of its own.
const BANDS = {
  top: "height",
  right: "width",
  bottom: "height",
  left: "width",
} as const;

const bandBoxes = new Map<keyof typeof BANDS, HTMLDivElement>();

function bandBox(band: keyof typeof BANDS): HTMLDivElement {
  let box = bandBoxes.get(band);
  if (!box) {
    box = document.createElement("div");
    box.style.cssText = `position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;${
      BANDS[band]
    }:var(--safe-${band})`;
    bandBoxes.set(band, box);
  }
  if (!box.isConnected) document.body.appendChild(box);
  return box;
}

function readBand(band: keyof typeof BANDS): number {
  const box = bandBox(band).getBoundingClientRect();
  return BANDS[band] === "width" ? box.width : box.height;
}

const readInsets = (): Insets => ({
  top: readBand("top"),
  right: readBand("right"),
  bottom: readBand("bottom"),
  left: readBand("left"),
});

// One read of the bands serves every layer, because the question they answer is the same one and a
// layer that takes the bands into its own box wants to be told when they move.
let bands: Accessor<Insets> | null = null;

function readBands(): Accessor<Insets> {
  return (bands ??= createRoot(() => {
    const [get, set] = createSignal(readInsets(), {
      equals: (a: Insets, b: Insets) =>
        a.top === b.top &&
        a.right === b.right &&
        a.bottom === b.bottom &&
        a.left === b.left,
    });
    const read = () => set(readInsets());
    // A fullscreen web app gets its bands a little after launch, and no `resize` or
    // `orientationchange` fires when they arrive, so these boxes are what to watch.
    if (typeof ResizeObserver !== "undefined") {
      const watch = new ResizeObserver(read);
      for (const band of Object.keys(BANDS) as (keyof typeof BANDS)[])
        watch.observe(bandBox(band));
      onCleanup(() => watch.disconnect());
    }
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return get;
  }));
}

/** The window's size, the width left inside its bands, and the bands themselves, kept current.
 *
 *  `safe` is one shared signal, read once and kept current: turning a phone around moves the
 *  island from one side to the other, and the two sizes stay as they were.
 *
 *  Waterfall and WaterfallSkeleton read the same `frameW`, so both paint one column count.
 */
export function watchViewport(): {
  viewportW: Accessor<number>;
  viewportH: Accessor<number>;
  frameW: Accessor<number>;
  safe: Accessor<Insets>;
} {
  const [viewportW, setViewportW] = createSignal(
    document.documentElement.clientWidth,
  );
  const [viewportH, setViewportH] = createSignal(window.innerHeight);
  const safe = readBands();
  const frameW = createMemo(() => viewportW() - safe().left - safe().right);
  const onResize = () => {
    setViewportW(document.documentElement.clientWidth);
    setViewportH(window.innerHeight);
  };
  onResize();
  window.addEventListener("resize", onResize);
  onCleanup(() => window.removeEventListener("resize", onResize));
  return { viewportW, viewportH, frameW, safe };
}

// A room measured from `innerHeight` grows and shrinks as Safari folds its bar away, which reads as
// the box jumping. `svh` is the height with the bar out, so it holds through the fold; a browser
// without the unit leaves the probe at no height, and the live number answers.
let tallProbe: HTMLDivElement | null = null;

/** The viewport's height as long as the browser's own chrome keeps it. */
export function steadyViewportH(): number {
  tallProbe ??= document.createElement("div");
  if (!tallProbe.isConnected) {
    tallProbe.style.cssText =
      "position:fixed;top:0;left:0;height:100svh;visibility:hidden;pointer-events:none";
    document.body.appendChild(tallProbe);
  }
  return tallProbe.getBoundingClientRect().height || window.innerHeight;
}

/** Watch one box's size, answered one frame after the browser reports it. A callback that writes
 *  layout in the step the observer fired from re-enters the observer, so the answer waits for the
 *  paint. A browser without the observer gets nothing watched; the returned call lets the box go
 *  either way. */
export function watchSize(el: HTMLElement, onSize: () => void): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};
  const sizes = new ResizeObserver(() => requestAnimationFrame(onSize));
  sizes.observe(el);
  return () => sizes.disconnect();
}
