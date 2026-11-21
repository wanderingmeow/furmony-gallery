import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FAST_PX_PER_MS,
  SETTLE_MS,
  createScrollMotion,
  isFast,
} from "./scrollMotion";

describe("isFast", () => {
  it("calls a thumb drag fast", () => {
    // 6000 px in one 16 ms frame, which is what a thumb does on a long list.
    expect(isFast(6000, 0, 16)).toBe(true);
  });

  it("calls a phone flick fast", () => {
    expect(isFast(1200, 800, 100)).toBe(true);
  });

  it("calls reading slow", () => {
    // 300 px over a third of a second, a pace a reader can stop on a card.
    expect(isFast(1300, 1000, 333)).toBe(false);
  });

  it("calls a still page slow", () => {
    expect(isFast(1000, 1000, 16)).toBe(false);
  });

  it("has no speed to measure when no time passed", () => {
    expect(isFast(9000, 0, 0)).toBe(false);
    expect(isFast(9000, 0, -3)).toBe(false);
  });

  it("treats the two directions the same", () => {
    // A reader can drag the thumb back up as fast as down.
    expect(isFast(0, 6000, 16)).toBe(true);
  });

  it("puts the line at FAST_PX_PER_MS", () => {
    expect(isFast(FAST_PX_PER_MS * 100 + 1, 0, 100)).toBe(true);
    expect(isFast(FAST_PX_PER_MS * 100, 0, 100)).toBe(false);
  });
});

describe("createScrollMotion", () => {
  // The report runs when the answer changes, so the list it received is the whole story of a run.
  function run() {
    const seen: boolean[] = [];
    const motion = createScrollMotion((fast) => seen.push(fast));
    return { seen, step: motion.step, dispose: motion.dispose };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("takes the position it first sees as a baseline", () => {
    const m = run();
    m.step(30000, 0);
    expect(m.seen).toEqual([]);
  });

  it("says fast once while the page keeps moving fast", () => {
    const m = run();
    m.step(0, 0);
    m.step(6000, 16);
    m.step(12000, 32);
    expect(m.seen).toEqual([true]);
  });

  it("brings the pictures back SETTLE_MS after the last fast step", () => {
    const m = run();
    m.step(0, 0);
    m.step(6000, 16);
    vi.advanceTimersByTime(SETTLE_MS - 1);
    expect(m.seen).toEqual([true]);
    vi.advanceTimersByTime(1);
    expect(m.seen).toEqual([true, false]);
  });

  it("moves that moment along with every fast step", () => {
    const m = run();
    m.step(0, 0);
    m.step(6000, 100);
    vi.advanceTimersByTime(SETTLE_MS - 10);
    m.step(12000, 200);
    vi.advanceTimersByTime(20);
    expect(m.seen).toEqual([true]);
    vi.advanceTimersByTime(SETTLE_MS);
    expect(m.seen).toEqual([true, false]);
  });

  it("lets the pictures in as soon as the reader can look at a card", () => {
    const m = run();
    m.step(0, 0);
    m.step(6000, 16);
    m.step(6100, 116);
    expect(m.seen).toEqual([true, false]);
  });

  it("says nothing while the page stays slow", () => {
    const m = run();
    m.step(0, 0);
    m.step(100, 100);
    m.step(200, 200);
    expect(m.seen).toEqual([]);
  });

  it("drops a release that is still pending when the page goes away", () => {
    const m = run();
    m.step(0, 0);
    m.step(6000, 16);
    m.dispose();
    vi.advanceTimersByTime(SETTLE_MS * 2);
    expect(m.seen).toEqual([true]);
  });
});
