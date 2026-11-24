import { describe, expect, it } from "vitest";
import { place } from "./popupPlace";

// a circle in the top bar of a desktop window
const TOP = { top: 12, bottom: 60, right: 1200 };
// one in the bottom bar
const LOW = { top: 700, bottom: 748, right: 1200 };
const DESK = { w: 1280, h: 800, steady: 800 };

describe("where a popup hangs from its button", () => {
  it("hangs below a circle in the top bar and keeps the far edge free", () => {
    expect(place(TOP, DESK, true)).toEqual({
      side: "top",
      at: 68,
      right: 80,
      room: 724,
    });
  });

  it("fills up to a circle in the bottom bar", () => {
    expect(place(LOW, DESK)).toEqual({
      side: "bottom",
      at: 108,
      right: 80,
      room: 684,
    });
  });

  it("measures the room it may fill against the height that stands still", () => {
    // Safari folds its bar away: the live viewport grows by 103, the room does not
    const bar = place(TOP, { w: 393, h: 852, steady: 749 }, true);
    const folded = place(TOP, { w: 393, h: 955, steady: 749 }, true);
    expect(folded.room).toBe(bar.room);
    expect(folded.at).toBe(bar.at);
  });

  it("tracks the live viewport with the edge a bottom bar hangs from", () => {
    const at = (h: number) => place(LOW, { w: 1280, h, steady: 700 }).at;
    expect(at(800)).toBe(108);
    expect(at(740)).toBe(48);
  });
});
