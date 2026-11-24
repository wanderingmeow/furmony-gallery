import { describe, expect, it } from "vitest";
import { scrollTakes, touchTakes } from "./popupScroll";

/** A popup with one scrolling list: `room` px of content below the window, `top` px scrolled. */
function popup({ room = 0, view = 100, top = 0 } = {}) {
  const box = document.createElement("div");
  const list = document.createElement("div");
  const row = document.createElement("div");
  box.append(list);
  list.append(row);
  Object.defineProperty(list, "scrollHeight", {
    value: view + room,
    configurable: true,
  });
  Object.defineProperty(list, "clientHeight", {
    value: view,
    configurable: true,
  });
  list.scrollTop = top;
  return { box, list, row };
}

describe("a wheel over a popup", () => {
  it("belongs to the nearest box inside that has room that way", () => {
    const { box, row } = popup({ room: 200 });
    expect(scrollTakes(box, row, 1)).toBe(true);
    expect(scrollTakes(box, row, -1)).toBe(false);
  });

  it("gives nothing to the page past either end", () => {
    const { box, list, row } = popup({ room: 200, top: 200 });
    expect(scrollTakes(box, row, 1)).toBe(false);
    list.scrollTop = 0;
    expect(scrollTakes(box, row, -1)).toBe(false);
  });

  it("says no when nothing inside has room", () => {
    const { box, row } = popup({ room: 0 });
    expect(scrollTakes(box, row, 1)).toBe(false);
  });

  it("says no for the box's own frame, which moves nothing", () => {
    const { box } = popup({ room: 200 });
    expect(scrollTakes(box, box, 1)).toBe(false);
  });

  it("leaves a pointer outside the box to the page", () => {
    const { box, row } = popup({ room: 200 });
    expect(scrollTakes(box, row, 1)).toBe(true);
    const outside = document.createElement("div");
    expect(scrollTakes(box, outside, 1)).toBe(false);
  });
});

describe("a finger on a popup", () => {
  it("stops at the popup's own ends", () => {
    const { box, row } = popup({ room: 200, top: 200 });
    expect(touchTakes(box, row, 0, -40)).toBe(false);
    expect(touchTakes(box, row, 0, 40)).toBe(true);
  });

  it("leaves a gesture that runs sideways alone", () => {
    const { box, row } = popup({ room: 0 });
    expect(touchTakes(box, row, -40, 6)).toBe(true);
    expect(touchTakes(box, row, 0, 0)).toBe(true);
  });

  it("answers for every vertical drag when the panel has nothing to scroll", () => {
    const { box, row } = popup({ room: 0 });
    expect(touchTakes(box, row, 0, -40)).toBe(false);
    expect(touchTakes(box, row, 0, 40)).toBe(false);
  });
});
