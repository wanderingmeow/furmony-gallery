import { describe, expect, it } from "vitest";
import { cardNeighbor, scrollForCard } from "./cardKeys";

const COLS = 4;
const WHOLE = 30;
const SHORT = 18;

describe("walking the grid", () => {
  it("steps down to the card in the same column below", () => {
    expect(cardNeighbor(5, COLS, WHOLE, "down")).toBe(9);
  });

  it("steps back up to where it came from", () => {
    expect(cardNeighbor(9, COLS, WHOLE, "up")).toBe(5);
  });

  it("has no card below the last row", () => {
    expect(cardNeighbor(28, COLS, WHOLE, "down")).toBeNull();
  });

  it("has no card above the first row", () => {
    expect(cardNeighbor(1, COLS, WHOLE, "up")).toBeNull();
  });

  it("reaches the card below a column the last row did reach", () => {
    expect(cardNeighbor(13, COLS, SHORT, "down")).toBe(17);
  });

  it("has no card below a column the last row never reached", () => {
    expect(cardNeighbor(14, COLS, SHORT, "down")).toBeNull();
  });

  it("walks a single column one card at a time", () => {
    expect(cardNeighbor(2, 1, 6, "down")).toBe(3);
    expect(cardNeighbor(0, 1, 6, "up")).toBeNull();
  });

  it("steps right to its neighbour in the same row", () => {
    expect(cardNeighbor(5, COLS, WHOLE, "right")).toBe(6);
  });

  it("steps left back to where it came from", () => {
    expect(cardNeighbor(6, COLS, WHOLE, "left")).toBe(5);
  });

  it("has no card left of a row's first", () => {
    expect(cardNeighbor(8, COLS, WHOLE, "left")).toBeNull();
  });

  it("has no card right of a row's last", () => {
    expect(cardNeighbor(11, COLS, WHOLE, "right")).toBeNull();
  });

  it("has no card right of the list's last", () => {
    expect(cardNeighbor(17, COLS, SHORT, "right")).toBeNull();
  });

  it("leaves a single column nothing sideways", () => {
    expect(cardNeighbor(2, 1, 6, "right")).toBeNull();
    expect(cardNeighbor(2, 1, 6, "left")).toBeNull();
  });
});

describe("keeping the chosen row in sight", () => {
  const row = {
    rowTop: 1200,
    rowHeight: 200,
    scrollY: 1000,
    viewport: 800,
    topPad: 120,
    bottomPad: 88,
  };

  it("leaves the page alone when the row is already whole", () => {
    expect(scrollForCard(row)).toBe(1000);
  });

  it("lifts the page when the row sits under the band", () => {
    expect(scrollForCard({ ...row, rowTop: 1050 })).toBe(930);
  });

  it("pushes the page down when the row hides behind the pill", () => {
    expect(scrollForCard({ ...row, rowTop: 1650 })).toBe(1138);
  });

  it("never asks for a scroll above the top of the document", () => {
    expect(scrollForCard({ ...row, scrollY: 0, rowTop: 60 })).toBe(0);
  });
});
