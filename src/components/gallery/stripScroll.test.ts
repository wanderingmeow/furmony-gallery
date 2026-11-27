import { describe, expect, it } from "vitest";
import { lastScroll, stripScroll, worthMoving } from "./stripScroll";

// A row of small copies 900 wide over content 3000 wide, so it runs 2100 past the window.
const LAST = lastScroll(3000, 900);

describe("where the strip lands on a chosen square", () => {
  it("centers a square that has room on both sides", () => {
    expect(stripScroll(1000, 60, LAST)).toBe(1060);
    expect(stripScroll(1000, -140, LAST)).toBe(860);
  });

  it("stops at the far end for a square near the end", () => {
    expect(stripScroll(1000, 1500, LAST)).toBe(2100);
    expect(stripScroll(1000, 9000, LAST)).toBe(2100);
  });

  it("stops at the near end for a square near the start", () => {
    expect(stripScroll(300, -400, LAST)).toBe(0);
    expect(stripScroll(0, -50, LAST)).toBe(0);
  });

  it("runs nowhere when the row already holds every square", () => {
    expect(LAST).toBe(2100);
    expect(lastScroll(800, 900)).toBe(0);
  });
});

describe("whether a move is worth animating", () => {
  it("says no to a move the clamp took away", () => {
    expect(worthMoving(stripScroll(2100, 40, LAST), 2100)).toBe(false);
    expect(worthMoving(stripScroll(0, -40, LAST), 0)).toBe(false);
  });

  it("says no to a shift of a pixel or less", () => {
    expect(worthMoving(1000, 1001)).toBe(false);
    expect(worthMoving(1002, 1000)).toBe(true);
  });
});
