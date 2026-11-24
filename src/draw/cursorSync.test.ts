import { describe, expect, it } from "vitest";
import { syncLeft } from "./cursorSync";

/** A chart whose plot area is `px` wide, over the [-0.5, n - 0.5] axis the monthly charts use. */
const chart = (px: number, n: number) => {
  const first = -0.5;
  return {
    posToVal: (pos: number) => first + (pos / px) * n,
    valToPos: (val: number) => ((val - first) / n) * px,
  };
};

describe("the hover line's trip to the other chart", () => {
  it("lands a pointer between two months on the same gap there", () => {
    // The seam between the first two months sits a quarter into either chart.
    expect(syncLeft(chart(100, 4), chart(200, 4), 25)).toBeCloseTo(50);
  });

  it("does not carry the pixel the source chart holds", () => {
    expect(syncLeft(chart(100, 4), chart(200, 4), 25)).not.toBe(25);
  });

  it("hides the line once the cursor has left the plot", () => {
    expect(syncLeft(chart(100, 4), chart(200, 4), null)).toBe(-1);
  });
});
