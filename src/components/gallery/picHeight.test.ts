import { describe, expect, it } from "vitest";
import { EASE } from "../../draw/anim";
import { fittedHeight, heightStyle, moveStyle } from "./picHeight";

const pic = (w: number, h: number) => ({ naturalWidth: w, naturalHeight: h });

describe("the height a picture stands at", () => {
  it("fills the width and stops at the ceiling", () => {
    expect(fittedHeight(pic(1000, 500), 1000, 900)).toBe(500);
    expect(fittedHeight(pic(1000, 500), 300, 900)).toBe(150);
    expect(fittedHeight(pic(1000, 500), 3000, 200)).toBe(200);
  });

  it("takes the ceiling alone when the height is held", () => {
    // a sideways source and a tall one, the same box
    expect(fittedHeight(pic(1000, 500), 300, 604, true)).toBe(604);
    expect(fittedHeight(pic(100, 900), 300, 604, true)).toBe(604);
  });

  it("waits for a width and a picture before measuring", () => {
    expect(fittedHeight(pic(1000, 500), 0, 604)).toBe(0);
    expect(fittedHeight(pic(1000, 0), 600, 604)).toBe(0);
  });
});

describe("the height a picture is drawn at", () => {
  it("prefers the ceiling when the height is held", () => {
    expect(
      heightStyle({ held: true, cap: 604, measured: 150, skeleton: 288 }),
    ).toBe("604px");
  });

  it("then the height it measured at, then the one the skeleton held", () => {
    expect(
      heightStyle({ held: false, cap: 604, measured: 150, skeleton: 288 }),
    ).toBe("150px");
    expect(
      heightStyle({ held: false, cap: 604, measured: 0, skeleton: 288 }),
    ).toBe("288px");
    expect(
      heightStyle({ held: false, cap: 604, measured: 0, skeleton: 0 }),
    ).toBe("auto");
  });
});

describe("the transition a picture carries", () => {
  it("times the fade alone when the height is held", () => {
    expect(moveStyle({ held: true, eased: true })).toBe("opacity 300ms");
    expect(moveStyle({ held: true, eased: false })).toBe("opacity 300ms");
  });

  it("adds the height once the layout has produced it", () => {
    expect(moveStyle({ held: false, eased: true })).toBe(
      `height 220ms ${EASE}, opacity 300ms`,
    );
    expect(moveStyle({ held: false, eased: false })).toBe("none");
  });
});
