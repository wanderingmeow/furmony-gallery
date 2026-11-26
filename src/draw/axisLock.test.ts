import { describe, expect, it } from "vitest";
import { createAxisLock, TAP_SLOP } from "./axisLock";

describe("the axis a finger meant", () => {
  it("decides nothing while the press is still a tap's drift", () => {
    const lock = createAxisLock();
    expect(lock.of(0, 0)).toBeNull();
    expect(lock.of(TAP_SLOP, 0)).toBeNull();
  });

  it("takes the longer component", () => {
    expect(createAxisLock().of(30, 4)).toBe("x");
    expect(createAxisLock().of(4, 30)).toBe("y");
  });

  it("hands a dead even move to the vertical, which is where a scroll lives", () => {
    expect(createAxisLock().of(20, 20)).toBe("y");
  });

  it("keeps the first decision for the rest of the gesture", () => {
    const lock = createAxisLock();
    expect(lock.of(30, 0)).toBe("x");
    expect(lock.of(30, 200)).toBe("x");
  });

  it("lets the next finger decide again", () => {
    const lock = createAxisLock();
    expect(lock.of(0, 40)).toBe("y");
    lock.reset();
    expect(lock.of(40, 0)).toBe("x");
  });

  it("waits longer for a sloppier surface", () => {
    const lock = createAxisLock(20);
    expect(lock.of(15, 0)).toBeNull();
    expect(lock.of(25, 0)).toBe("x");
  });
});
