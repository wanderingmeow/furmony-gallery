// Tests that both endpoints really end up in the result. In tests api.ts reads the saved
// copies in agent/*.json instead of calling the site, so this needs no network — and those
// copies are gitignored, hence the skip.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdoptListing } from "../model/types";
import { LIST_PAGE_SIZE } from "./endpoints";

const fixtures = import.meta.glob("../../agent/*_sample.json");
const haveFixtures = Object.keys(fixtures).length >= 2;
const twFixtures = import.meta.glob("../../agent/*_sample.zh_tw.json");
const haveTwFixtures = Object.keys(twFixtures).length >= 2;

describe.skipIf(!haveFixtures)(
  "fetchAllListings combines both endpoints",
  () => {
    it("appends the 新作登场 rows onto the main list with no duplicate ids", async () => {
      const { fetchAllListings } = await import("./api");
      const { rows, complete } = await fetchAllListings();
      // Both lists answer here, so this load is complete.
      expect(complete).toBe(true);

      const ids = rows.map((l: AdoptListing) => l.adoptId);
      expect(new Set(ids).size).toBe(ids.length); // every id appears exactly once

      // these three only exist on the 新作登场 endpoint — drop that request or the merge and
      // they silently vanish from the whole app
      for (const debutId of [2831, 2832, 2833]) expect(ids).toContain(debutId);
    });
  },
);

describe.skipIf(!haveTwFixtures)(
  "fetchAllListings keeps one language for one load",
  () => {
    it("asks both lists in the language the load was given", async () => {
      const { fetchAllListings } = await import("./api");
      const { rows } = await fetchAllListings(1, undefined, "zh_tw");

      // 2868 only comes from the 新作登场 list, which is the second request of the load
      expect(
        rows.find((l: AdoptListing) => l.adoptId === 2868)?.harmonyPainterVo
          ?.painterName,
      ).toBe("神秘組織");
      expect(
        rows.find((l: AdoptListing) => l.adoptId === 2867)?.harmonyPainterVo
          ?.painterName,
      ).toBe("神秘組織");
    });
  },
);

// The API's own order for these two lists is not fixed - see api.ts.
describe("listAnswer", () => {
  // An empty list and a failed request have to arrive as different values, because the app rewrites
  // saved data whenever it believes the site answered in full.
  it("reads an empty list as an answer", async () => {
    const { listAnswer } = await import("./api");
    expect(
      await listAnswer(
        () => Promise.resolve([]),
        () => {},
      ),
    ).toEqual({
      rows: [],
      complete: true,
    });
  });

  it("keeps a failure apart from an empty list", async () => {
    const { listAnswer } = await import("./api");
    const misses: unknown[] = [];
    const answer = await listAnswer(
      () => Promise.reject(new Error("timeout")),
      (e) => misses.push(e),
    );
    expect(answer).toEqual({ rows: [], complete: false });
    expect(misses).toHaveLength(1);
  });
});

describe("sortColorsAndPictures", () => {
  const row = (over: Partial<AdoptListing>): AdoptListing => ({
    adoptId: 1,
    paintersId: 1,
    productId: 1,
    ...over,
  });

  it("puts colors in colorId order", async () => {
    const { sortColorsAndPictures } = await import("./api");
    const settled = sortColorsAndPictures(
      row({ harmonyAdoptColorVos: [{ colorId: 4 }, { colorId: 1 }] }),
    );
    expect(settled.harmonyAdoptColorVos!.map((c) => c.colorId)).toEqual([1, 4]);
  });

  it("puts pictures in path order, ignoring the signature", async () => {
    const { sortColorsAndPictures } = await import("./api");
    const settled = sortColorsAndPictures(
      row({
        harmonyAdoptDetails: [
          { detailPicture: "https://cdn/b.png?q-signature=zzz" },
          { detailPicture: "https://cdn/a.jpg?q-signature=aaa" },
        ],
      }),
    );
    expect(settled.harmonyAdoptDetails!.map((d) => d.detailPicture)).toEqual([
      "https://cdn/a.jpg?q-signature=aaa",
      "https://cdn/b.png?q-signature=zzz",
    ]);
  });

  it("leaves a row without those lists alone", async () => {
    const { sortColorsAndPictures } = await import("./api");
    expect(sortColorsAndPictures(row({})).harmonyAdoptColorVos).toBeUndefined();
  });
});

// The timings are what this test is about: a retry that fires immediately gets the same challenge
// page back from the WAF.
describe("withRetry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the first success without waiting", async () => {
    vi.useFakeTimers();
    const { withRetry } = await import("./api");
    let calls = 0;
    const done = withRetry(3, async () => {
      calls++;
      return "ok";
    });
    await expect(done).resolves.toBe("ok");
    expect(calls).toBe(1);
  });

  it("waits 400ms before the second attempt and 1200ms more before the third", async () => {
    vi.useFakeTimers();
    const { withRetry } = await import("./api");
    let calls = 0;
    const done = withRetry(3, async () => {
      calls++;
      if (calls < 3) throw new Error("challenge");
      return "ok";
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(399);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(1199);
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toBe(3);
    await expect(done).resolves.toBe("ok");
  });

  // A load the reader walked away from has no reason to sit through the waits.
  it("stops trying once the request is cancelled", async () => {
    const { withRetry } = await import("./api");
    const controller = new AbortController();
    let calls = 0;
    const done = withRetry(
      3,
      async () => {
        calls++;
        controller.abort();
        throw new Error("aborted");
      },
      controller.signal,
    );
    await expect(done).rejects.toThrow("aborted");
    expect(calls).toBe(1);
  });

  it("gives up with the last error", async () => {
    vi.useFakeTimers();
    const { withRetry } = await import("./api");
    let calls = 0;
    const done = withRetry(2, async () => {
      calls++;
      throw new Error(`attempt ${calls} failed`);
    });
    // The expectation is attached before the clock moves, so the rejection has a handler the moment
    // it exists.
    const settles = expect(done).rejects.toThrow("attempt 2 failed");
    await vi.advanceTimersByTimeAsync(5000);
    await settles;
    expect(calls).toBe(2);
  });
});

// The boundaries below are for a list that outgrows one page. They are written in page widths,
// because the row count changes over time.
describe("missingPages", () => {
  const P = LIST_PAGE_SIZE;
  const cases: [number, number[]][] = [
    [0, []],
    [P - 1, []],
    [P, []],
    [P + 1, [2]],
    [P * 2, [2]],
    [P * 2 + 1, [2, 3]],
  ];

  for (const [total, want] of cases) {
    it(`leaves ${want.length ? want.join(" and ") : "no page"} for a list of ${total}`, async () => {
      const { missingPages } = await import("./api");
      expect(missingPages(total)).toEqual(want);
    });
  }
});
