import {
  type Accessor,
  createMemo,
  createRoot,
  createSignal,
  onCleanup,
} from "solid-js";
import type { Insets } from "../../draw/layout";

// `env()` becomes a length only once it reaches a property that takes one, so each band is read
// off a box whose own width or height is the --safe-* name the CSS pads with.
let probe: HTMLDivElement | null = null;

function readInset(size: "width" | "height", name: string): number {
  probe ??= document.createElement("div");
  if (!probe.isConnected) {
    probe.style.cssText =
      "position:fixed;top:0;left:0;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
  }
  probe.style[size] = `var(${name})`;
  const box = probe.getBoundingClientRect();
  return size === "width" ? box.width : box.height;
}

const readInsets = (): Insets => ({
  top: readInset("height", "--safe-top"),
  right: readInset("width", "--safe-right"),
  bottom: readInset("height", "--safe-bottom"),
  left: readInset("width", "--safe-left"),
});

// One read of the bands serves every layer, because the question they answer is the same one and a
// layer that takes the bands into its own box wants to be told when they move.
let insets: { get: Accessor<Insets>; set: (next: Insets) => void } | null =
  null;

function insetStore() {
  return (insets ??= createRoot(() => {
    const [get, set] = createSignal(readInsets(), {
      equals: (a: Insets, b: Insets) =>
        a.top === b.top &&
        a.right === b.right &&
        a.bottom === b.bottom &&
        a.left === b.left,
    });
    const read = () => set(readInsets());
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return { get, set };
  }));
}

/** The bands as the screen reports them right now. A layer that pads them takes this reading as it
 *  rises: iOS answers a turn slowly, and the first one after it can still say the island is nowhere. */
export function remeasureInsets(): void {
  insetStore().set(readInsets());
}

/** The window's size, the width left inside its bands, and the bands themselves, kept current.
 *
 *  `safe` is one shared signal rather than a measurement taken where it is used: turning a phone
 *  around moves the island from one side to the other and changes neither size.
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
  const safe = insetStore().get;
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
