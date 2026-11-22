// The foot box is where a screen paints its own bottom bar. The box carries a marker, like the
// scroller does, so these tests do not guess which child of the card it is.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSignal, Show, type JSX } from "solid-js";
import { Portal, render } from "solid-js/web";
import { Sheet } from "./Sheet";
import { useSheetFooter } from "../ui/boxes";

let disposeApp: () => void;
let host: HTMLDivElement;

// The screen the sheet believes it is on. watchViewport reads both numbers from the document, and a
// landscape one makes the sheet a panel in from every edge instead of a card off the bottom.
function setScreen(w: number, h: number): void {
  Object.defineProperty(document.documentElement, "clientWidth", {
    value: w,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: h,
    configurable: true,
  });
}

function mount(
  view: () => JSX.Element,
  screen: [number, number] = [393, 852],
): void {
  setScreen(screen[0], screen[1]);
  host = document.createElement("div");
  document.body.appendChild(host);
  disposeApp = render(view, host);
}

afterEach(() => {
  disposeApp();
  host.remove();
});

// A screen that carries its own bar. It reads the box once, when the screen is created, the way
// Detail does.
function Screen(): JSX.Element | undefined {
  const box = useSheetFooter();
  return (
    <Show when={box}>
      <Portal mount={box} useShadow={false}>
        <button type="button" id="bar">
          前往官网
        </button>
      </Portal>
    </Show>
  );
}

const footBox = () => document.querySelector("[data-sheet-footer]");
const bar = () => document.querySelector("#bar");
const layer = () => document.querySelector(".sheet-card");
// The slide runs 300ms and the layer leaves a little after it.
const EXIT_MS = 400;

// A screen with its own close button, the way Detail wires its ✕.
function Closable(props: { onDismiss: () => void }) {
  return (
    <button type="button" id="close" onClick={() => props.onDismiss()}>
      关闭
    </button>
  );
}

describe("the foot box a screen paints its bar into", () => {
  it("holds the bar on the first open", () => {
    const [open, setOpen] = createSignal(false);
    mount(() => (
      <Sheet open={open} onDismiss={() => setOpen(false)}>
        {() => <Screen />}
      </Sheet>
    ));
    setOpen(true);
    expect(bar()).toBeTruthy();
    expect(bar()!.isConnected).toBe(true);
    expect(footBox()!.contains(bar())).toBe(true);
  });

  it("holds the bar again after a close and a reopen", () => {
    const [open, setOpen] = createSignal(false);
    mount(() => (
      <Sheet open={open} onDismiss={() => setOpen(false)}>
        {() => <Screen />}
      </Sheet>
    ));
    setOpen(true);
    setOpen(false);
    setOpen(true);
    expect(bar()).toBeTruthy();
    expect(bar()!.isConnected).toBe(true);
    expect(footBox()!.contains(bar())).toBe(true);
  });

  it("leaves the box empty when no screen claims it", () => {
    const [open, setOpen] = createSignal(false);
    mount(() => (
      <Sheet open={open} onDismiss={() => setOpen(false)}>
        {() => <span>body</span>}
      </Sheet>
    ));
    setOpen(true);
    expect(bar()).toBeNull();
    expect(footBox()!.textContent).toBe("");
  });
});

describe("the slide out", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for the slide when the route lets go", () => {
    vi.useFakeTimers();
    const [open, setOpen] = createSignal(true);
    mount(() => (
      <Sheet open={open} onDismiss={() => setOpen(false)}>
        {() => <Screen />}
      </Sheet>
    ));
    expect(layer()).toBeTruthy();
    setOpen(false);
    // The route is already gone. The slide still has to run before the layer is.
    expect(layer()).toBeTruthy();
    vi.advanceTimersByTime(EXIT_MS);
    expect(layer()).toBeNull();
  });

  it("stays when the route comes back during the slide", () => {
    vi.useFakeTimers();
    const [open, setOpen] = createSignal(true);
    mount(() => (
      <Sheet open={open} onDismiss={() => setOpen(false)}>
        {() => <Screen />}
      </Sheet>
    ));
    setOpen(false);
    vi.advanceTimersByTime(100);
    setOpen(true);
    vi.advanceTimersByTime(EXIT_MS);
    expect(layer()).toBeTruthy();
  });

  it("leaves the route only after the slide, from the close button", () => {
    vi.useFakeTimers();
    let left = 0;
    const [open, setOpen] = createSignal(true);
    mount(() => (
      <Sheet
        open={open}
        onDismiss={() => {
          left++;
          setOpen(false);
        }}
      >
        {(dismiss) => <Closable onDismiss={dismiss} />}
      </Sheet>
    ));
    document.getElementById("close")!.click();
    expect(left).toBe(0); // the slide runs first
    expect(layer()).toBeTruthy();
    vi.advanceTimersByTime(EXIT_MS);
    expect(left).toBe(1);
    expect(layer()).toBeNull();
  });
});

// draw/layout.test.ts covers which screens split into two columns. These cover what the sheet does
// about it: it stops sliding, stops offering a drag, and lets a mouse click past its edge.
const backdrop = () => document.querySelector("[data-sheet-backdrop]");
const frame = () => (layer() as HTMLElement).parentElement as HTMLElement;
const look = () => (layer() as HTMLElement).style;
const body = () => (
  <Sheet open={() => true} onDismiss={dismissed}>
    {() => <span>body</span>}
  </Sheet>
);
let dismissed: () => void;

describe("the panel on a landscape screen", () => {
  const PANEL: [number, number] = [1133, 744];
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sits in from every edge and gives up the slide", () => {
    dismissed = vi.fn();
    mount(body, PANEL);
    expect(frame().style.padding).toBe("24px");
    expect(look().getPropertyValue("max-width")).toBe("1080px");
    expect(look().height).toBe("100%");
    expect(frame().style.transform).not.toContain("translateY");
  });

  it("keeps the slide and the phone sizes on a phone", () => {
    dismissed = vi.fn();
    mount(body);
    expect(frame().style.padding).toBe("");
    expect(look().getPropertyValue("max-width")).toBe("");
    expect(frame().style.transform).toContain("translateY");
  });

  it("keeps no gap and no rounded corner on a screen too short for one", () => {
    dismissed = vi.fn();
    mount(body, [852, 393]);
    expect(frame().style.padding).toBe("0px");
    expect(look().getPropertyValue("border-radius")).toBe("0px");
  });

  it("closes when a mouse clicks past its edge, once the fade has run", () => {
    vi.useFakeTimers();
    dismissed = vi.fn();
    mount(body, PANEL);
    backdrop()!.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerType: "mouse" }),
    );
    expect(dismissed).not.toHaveBeenCalled(); // the fade runs first
    vi.advanceTimersByTime(300);
    expect(dismissed).toHaveBeenCalledTimes(1);
  });

  it("does not close when a finger rests on that edge", () => {
    vi.useFakeTimers();
    dismissed = vi.fn();
    mount(body, PANEL);
    backdrop()!.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerType: "touch" }),
    );
    vi.advanceTimersByTime(300);
    expect(dismissed).not.toHaveBeenCalled();
  });

  it("has no drag to dismiss, so a scroll never becomes a close", () => {
    dismissed = vi.fn();
    mount(body, PANEL);
    const scroller = document.querySelector("[data-sheet-scroll]")!;
    const drag = (type: string, y: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, {
        touches: [{ identifier: 1, clientX: 200, clientY: y }],
      });
      scroller.dispatchEvent(event);
    };
    drag("touchstart", 100);
    drag("touchmove", 400);
    drag("touchend", 400);
    expect(dismissed).not.toHaveBeenCalled();
    expect(frame().style.transform).not.toContain("translateY");
  });
});

// The switch is read where each animation starts, so the stub outlives the mount.
const realMatchMedia = window.matchMedia;
function reduceMotion(on: boolean): void {
  window.matchMedia = ((q: string) => ({
    matches: on && q.includes("reduced-motion"),
    media: q,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

const scroller = () => document.querySelector("[data-sheet-scroll]")!;
function drag(type: string, y: number): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    touches: [{ identifier: 1, clientX: 200, clientY: y }],
  });
  scroller().dispatchEvent(event);
}

describe("the phone sheet under reduce motion", () => {
  afterEach(() => {
    vi.useRealTimers();
    window.matchMedia = realMatchMedia;
  });

  it("fades in place instead of sliding up", () => {
    dismissed = vi.fn();
    reduceMotion(true);
    mount(body);
    expect(frame().style.transform).not.toContain("translateY");
    expect(frame().style.transform).not.toContain("scale"); // growing would uncover the backdrop
    expect(frame().style.padding).toBe("0px");
    expect(frame().style.transition).toContain("opacity 180ms");
  });

  it("closes on the fade's clock, not the slide's", () => {
    vi.useFakeTimers();
    let left = 0;
    const [open, setOpen] = createSignal(true);
    reduceMotion(true);
    mount(() => (
      <Sheet
        open={open}
        onDismiss={() => {
          left++;
          setOpen(false);
        }}
      >
        {(dismiss) => <Closable onDismiss={dismiss} />}
      </Sheet>
    ));
    document.getElementById("close")!.click();
    vi.advanceTimersByTime(259);
    expect(left).toBe(0);
    // 260ms: the fade plus the settle; the slide would still have 120ms to run.
    vi.advanceTimersByTime(1);
    expect(left).toBe(1);
  });

  it("keeps the finger on the transform, so a drag still moves the sheet", () => {
    dismissed = vi.fn();
    reduceMotion(true);
    mount(body);
    drag("touchstart", 100);
    drag("touchmove", 400);
    expect(frame().style.transform).toContain("translateY");
    expect(frame().style.transition).toBe("none");
  });

  it("gives the close back to the fade once a bounce back has landed", () => {
    vi.useFakeTimers();
    let left = 0;
    const [open, setOpen] = createSignal(true);
    reduceMotion(true);
    mount(() => (
      <Sheet
        open={open}
        onDismiss={() => {
          left++;
          setOpen(false);
        }}
      >
        {(dismiss) => <Closable onDismiss={dismiss} />}
      </Sheet>
    ));
    drag("touchstart", 100);
    drag("touchmove", 200); // too short a pull to close, so the sheet returns
    drag("touchend", 200);
    expect(frame().style.transition).toContain("transform 300ms");
    vi.advanceTimersByTime(300);
    document.getElementById("close")!.click();
    expect(frame().style.transition).toContain("opacity 180ms");
    vi.advanceTimersByTime(260);
    expect(left).toBe(1);
  });
});
