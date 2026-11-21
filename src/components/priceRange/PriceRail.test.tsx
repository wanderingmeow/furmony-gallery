// PriceRail: which end a press belongs to, what a press shows, and what the thumbs read back. The
// rules behind it (where an end lands, how far a drag may go) are in model/priceRange.test.ts.
import { afterEach, describe, expect, it } from "vitest";
import { render } from "solid-js/web";
import { PriceRail } from "./PriceRail";
import type { PriceEnd, PriceRange } from "../../model/priceRange";

const EDGES = [20000, 22000, 24000, 26000];

let dispose: (() => void) | undefined;
let host: HTMLDivElement;
const moves: [PriceEnd, number][] = [];
// What the block above answers with. A test sets it before it presses.
let held: PriceRange = [20000, 26000];

// A row 244px wide: a thumb's center may sit from 11px inside one end to 11px inside the other, so
// xAt(1 / 3) is a press on the second edge.
const ROW = { left: 100, width: 244 };
const xAt = (share: number): number => ROW.left + 11 + (ROW.width - 22) * share;

function draw(ends: PriceRange, answer = ends): void {
  dispose?.();
  host?.remove();
  moves.length = 0;
  held = answer;
  host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(
    () => (
      <PriceRail
        steps={EDGES}
        ends={ends}
        onMove={(end, index) => {
          moves.push([end, index]);
          return held;
        }}
      />
    ),
    host,
  );
  const slide = host.querySelector<HTMLElement>(".pr-slide");
  if (slide)
    slide.getBoundingClientRect = () =>
      ({
        left: ROW.left,
        width: ROW.width,
        x: ROW.left,
        y: 0,
        top: 0,
        bottom: 26,
        right: ROW.left + ROW.width,
        height: 26,
      }) as DOMRect;
}

const thumbs = () =>
  Array.from(host.querySelectorAll<HTMLInputElement>('input[type="range"]'));
const strips = () => Array.from(host.querySelectorAll<HTMLElement>(".pr-seek"));

/** A press on one of the seek strips at `clientX`, held until `letGo`. */
function press(which: number, clientX = 0): void {
  strips()[which].dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, clientX }),
  );
}
const letGo = (which: number) =>
  strips()[which].dispatchEvent(new Event("pointerup", { bubbles: true }));
const drag = (which: number, value: number) => {
  const el = thumbs()[which];
  el.value = String(value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

afterEach(() => {
  dispose?.();
  host?.remove();
});

describe("PriceRail", () => {
  it("moves the end whose side of the row a press lands on", () => {
    draw([20000, 26000]);
    press(0, xAt(1 / 3));
    expect(moves).toEqual([["low", 1]]);
    moves.length = 0;
    // Two thirds along is the expensive end's own half; the cheap end stays where it was.
    press(1, xAt(2 / 3));
    expect(moves).toEqual([["high", 2]]);
  });

  // Where the circles overlap, the one on top is what the reader sees, and what a press takes.
  it("keeps the end that was pressed last on top of the other", () => {
    draw([20000, 26000]);
    const [low, high] = thumbs();
    press(0);
    expect(low.style.zIndex).toBe("3");
    expect(high.style.zIndex).toBe("2");
    // The circle grows even though the press landed on the strip, not on the circle.
    expect(low.classList.contains("pr-grab")).toBe(true);
    expect(high.classList.contains("pr-grab")).toBe(false);
    letGo(0);
    // After release this end stays on top, because it is the one the reader just used.
    expect(low.style.zIndex).toBe("3");
    expect(low.classList.contains("pr-grab")).toBe(false);
    press(1);
    expect(high.style.zIndex).toBe("3");
    expect(low.style.zIndex).toBe("2");
  });

  // The boundary steps around the circle on top, so a visible circle is pressed as a whole. The
  // stylesheet holds both versions; the class here picks which one applies.
  it("moves the boundary with the circle that is on top", () => {
    draw([20000, 26000]);
    const slide = () => host.querySelector(".pr-slide");
    expect(slide()?.classList.contains("pr-top-low")).toBe(false);
    press(0);
    expect(slide()?.classList.contains("pr-top-low")).toBe(true);
    press(1);
    expect(slide()?.classList.contains("pr-top-low")).toBe(false);
  });

  it("puts the end away from its wall on top before anything is pressed", () => {
    draw([24000, 26000]);
    const [low, high] = thumbs();
    expect(low.style.zIndex).toBe("3");
    expect(high.style.zIndex).toBe("2");
  });

  // The browser moves the thumb on its own, so a pair that did not move has to go back on it.
  it("puts the pair it was handed back on the thumb", () => {
    draw([22000, 24000]);
    drag(0, 2);
    expect(moves).toEqual([["low", 2]]);
    expect(thumbs()[0].value).toBe("1");
  });

  // Safari hands :focus-visible to a focus that a press gives over, so the ring follows the
  // keyboard instead.
  it("rings the thumb for a key, and not for a press", () => {
    draw([20000, 26000]);
    press(0);
    expect(thumbs()[0].classList.contains("pr-key")).toBe(false);
    letGo(0);
    thumbs()[0].dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(thumbs()[0].classList.contains("pr-key")).toBe(true);
  });

  it("rings the end Tab reaches, and stops when focus leaves it", () => {
    draw([20000, 26000]);
    thumbs()[1].focus();
    expect(thumbs()[1].classList.contains("pr-key")).toBe(true);
    thumbs()[1].blur();
    expect(thumbs()[1].classList.contains("pr-key")).toBe(false);
  });

  it("says its own price to a screen reader, and hides the strips from one", () => {
    draw([20000, 24000]);
    expect(thumbs().map((el) => el.getAttribute("aria-valuetext"))).toEqual([
      "¥20000",
      "¥24000",
    ]);
    expect(
      strips().every((el) => el.getAttribute("aria-hidden") === "true"),
    ).toBe(true);
  });
});
