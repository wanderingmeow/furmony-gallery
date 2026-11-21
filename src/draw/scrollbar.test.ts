import { describe, expect, it } from "vitest";
import { pointerProgress, previewTop, scrollThumb } from "./scrollbar";

// 1000px of content in a 400px window: 600px of scroll, on a 200px track.
const TRACK_LEFT = 1000;
const at = (scrollLeft: number, track = 200, min = 24) =>
  scrollThumb({ scrollLeft, scrollWidth: 1000, clientWidth: 400 }, track, min);

describe("scrollThumb", () => {
  it("is a quarter of the track, at its left, when a quarter is visible", () => {
    expect(at(0)).toEqual({ width: 80, offset: 0 });
  });

  it("ends flush with the right edge", () => {
    expect(at(600)).toEqual({ width: 80, offset: 120 });
  });

  it("moves in proportion to the scroll", () => {
    expect(at(300)).toEqual({ width: 80, offset: 60 });
  });

  it("holds the thumb of a long list at the floor", () => {
    // 4000px of content would put the thumb at 20px, under the floor
    const row = (scrollLeft: number) => ({
      scrollLeft,
      scrollWidth: 4000,
      clientWidth: 400,
    });
    expect(scrollThumb(row(0), 200, 24)).toEqual({ width: 24, offset: 0 });
    expect(scrollThumb(row(3600), 200, 24)).toEqual({ width: 24, offset: 176 });
  });

  it("fits the thumb into a track narrower than the floor", () => {
    // a 20px track cannot hold a 24px thumb
    expect(at(600, 20)).toEqual({ width: 20, offset: 0 });
  });

  it("shows nothing where there is nothing to scroll", () => {
    expect(
      scrollThumb(
        { scrollLeft: 0, scrollWidth: 400, clientWidth: 400 },
        200,
        24,
      ),
    ).toBeNull();
    expect(
      scrollThumb(
        { scrollLeft: 0, scrollWidth: 1000, clientWidth: 400 },
        0,
        24,
      ),
    ).toBeNull();
  });

  it("clamps a row dragged past either end", () => {
    // literals: with a broken clamp two calls agree, so comparing them proves nothing
    expect(at(5000)).toEqual({ width: 80, offset: 120 });
    expect(at(-50)).toEqual({ width: 80, offset: 0 });
  });
});

describe("pointerProgress", () => {
  // a disagreement between the two directions throws the thumb out from under the hand
  it("agrees with scrollThumb about where a grab lands", () => {
    for (const scrollLeft of [0, 150, 300, 600]) {
      const thumb = at(scrollLeft);
      expect(thumb, "the row scrolls, so there is a thumb").not.toBeNull();
      const t = thumb!;
      const clientX = TRACK_LEFT + t.offset + t.width / 2;
      const progress = pointerProgress(clientX, TRACK_LEFT, 200, t);
      expect(
        progress * 600,
        `a grab at the middle of the thumb at ${scrollLeft}px`,
      ).toBeCloseTo(scrollLeft, 5);
    }
  });

  it("keeps a pointer outside the track at either end", () => {
    const thumb = { width: 80, offset: 0 };
    expect(pointerProgress(TRACK_LEFT - 12, TRACK_LEFT, 200, thumb)).toBe(0);
    expect(pointerProgress(TRACK_LEFT + 212, TRACK_LEFT, 200, thumb)).toBe(1);
  });

  it("has nowhere to go when the thumb is the whole track", () => {
    expect(
      pointerProgress(TRACK_LEFT + 100, TRACK_LEFT, 200, {
        width: 200,
        offset: 0,
      }),
    ).toBe(0);
  });
});

describe("previewTop", () => {
  // 800 visible of 3200 on a 600px track: a 150px thumb, centers from 75 to 525 of a track
  // that starts 100px down the window.
  const at = (scrollTop: number, scrollRange = 2400) =>
    previewTop(scrollTop, scrollRange, 800, { top: 100, bottom: 700 }, 36);

  it("sits on the middle of the thumb, at the top", () => {
    expect(at(0)).toBe(157);
  });

  it("sits on the middle of the thumb, at the bottom", () => {
    expect(at(2400)).toBe(607);
  });

  it("holds the middle of the edge at the middle of the page", () => {
    expect(at(1200)).toBe(382);
  });

  it("is null until the page has one full screen of scroll", () => {
    expect(at(200, 799)).toBeNull();
    expect(at(200, 0)).toBeNull();
    expect(at(1200, 2400)).toBe(382);
  });

  it("stays on the thumb when the page is long and the thumb is at its floor", () => {
    // the thumb sits at its 24px floor, so the chip reaches both ends of the track
    expect(at(0, 100000)).toBe(100);
    expect(at(50000, 100000)).toBe(382);
    expect(at(100000, 100000)).toBe(664);
  });

  it("keeps a scroll past the end on the last thumb position", () => {
    expect(at(9000)).toBe(607);
  });

  it("never leaves the track", () => {
    // a track that starts 72px down the edge and stops 140px short of the bottom
    const edge = (n: number) =>
      previewTop(n, 2400, 800, { top: 72, bottom: 712 }, 36)!;
    expect(edge(0)).toBeGreaterThanOrEqual(72);
    expect(edge(2400)).toBeLessThanOrEqual(712 - 36);
  });

  it("is null when the chrome has left less room than the chip needs", () => {
    expect(previewTop(200, 2400, 800, { top: 72, bottom: 100 }, 36)).toBeNull();
  });

  it("centers the chip when the window is shorter than the thumb floor", () => {
    // a thumb cannot run longer than its track, so both ends of a short window share a centre
    expect(previewTop(0, 200, 20, { top: 0, bottom: 20 }, 8)).toBe(6);
    expect(previewTop(200, 200, 20, { top: 0, bottom: 20 }, 8)).toBe(6);
  });
});
