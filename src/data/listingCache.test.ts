// Functional tests for the listings cache (listingCache.ts). No network, no rendering.
// fake-indexeddb provides a real-ish IndexedDB; localStorage comes from the testSetup shim.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdoptListing } from "../model/types";

type CacheModule = typeof import("./listingCache");

function makeListing(overrides: Partial<AdoptListing> = {}): AdoptListing {
  return { adoptId: 1, paintersId: 1, productId: 1, ...overrides };
}

// A fresh module per test keeps module-level state to itself. The fake-indexeddb database is
// shared, so the table is emptied between tests.
let mod: CacheModule;
beforeEach(async () => {
  vi.resetModules();
  mod = await import("./listingCache");
  await mod.clearListings();
});

describe("listings cache (adoptId-keyed table + order record)", () => {
  it("saveListings → loadListings round-trips and preserves display order", async () => {
    const rows = [
      makeListing({ adoptId: 3, adoptName: "c" }),
      makeListing({ adoptId: 1, adoptName: "a" }),
      makeListing({ adoptId: 2, adoptName: "b" }),
    ];
    await mod.saveListings(rows, "zh");
    const loaded = await mod.loadListings("zh");
    expect(loaded!.map((l) => l.adoptId)).toEqual([3, 1, 2]); // order preserved, not adoptId-sorted
    expect(loaded![0].adoptName).toBe("c");
  });

  it("returns null when empty", async () => {
    expect(await mod.loadListings("zh")).toBeNull();
  });

  // The API writes names and descriptions in the language the request asked in, so a cache
  // kept in another language would paint the old words for a moment before the new ones arrived.
  it("answers null to a language the cache was not kept in", async () => {
    await mod.saveListings(
      [makeListing({ adoptId: 1, adoptName: "名字甲" })],
      "zh",
    );
    expect(await mod.loadListings("pa")).toBeNull();
    expect((await mod.loadListings("zh"))!.map((l) => l.adoptName)).toEqual([
      "名字甲",
    ]);
  });

  it("clearListings empties the table", async () => {
    await mod.saveListings([makeListing({ adoptId: 1 })], "zh");
    await mod.clearListings();
    expect(await mod.loadListings("zh")).toBeNull();
  });
});

describe("mergeListings (what the reader would see)", () => {
  // The API signs every cover on every request, so a second fetch carries a new query string
  // on every URL and the same pictures.
  const signed = (id: number, sig: string): AdoptListing => ({
    adoptId: id,
    paintersId: 1,
    productId: 1,
    adoptPicture: `https://cdn.example/${id}.jpg?q-signature=${sig}`,
    harmonyAdoptDetails: [
      { detailPicture: `https://cdn.example/${id}-1.jpg?q-signature=${sig}` },
    ],
  });

  it("a new signature is the same row, and keeps its object", async () => {
    const before = signed(1, "aaa");
    const after = signed(1, "bbb");
    const r = await mod.mergeListings([before], [after], "zh");
    expect(r.changed).toBe(false);
    expect(r.updated[0]).toBe(before);
  });

  it("unchanged rows keep their objects, a changed row takes the new one", async () => {
    const a = makeListing({ adoptId: 1, allcost: 10 });
    const b = makeListing({ adoptId: 2, allcost: 100 });
    // a fresh parse of the same row: equal content, different object
    const aAgain = { ...makeListing({ adoptId: 1, allcost: 10 }) };
    const bCheaper = makeListing({ adoptId: 2, allcost: 80 });
    const r = await mod.mergeListings([a, b], [aAgain, bCheaper], "zh");
    expect(r.changed).toBe(true);
    expect(r.updated[0]).toBe(a); // the card for row 1 keeps its DOM node
    expect(r.updated[1]).toBe(bCheaper);
  });

  it("a shuffle is a change, and every row keeps its object", async () => {
    const a = makeListing({ adoptId: 1 });
    const b = makeListing({ adoptId: 2 });
    const r = await mod.mergeListings([a, b], [{ ...b }, { ...a }], "zh");
    expect(r.changed).toBe(true);
    expect(r.updated[0]).toBe(b);
    expect(r.updated[1]).toBe(a);
  });

  it("a removed row is a change", async () => {
    const a = makeListing({ adoptId: 1 });
    const b = makeListing({ adoptId: 2 });
    const r = await mod.mergeListings([a, b], [{ ...a }], "zh");
    expect(r.changed).toBe(true);
    expect(r.updated.map((l) => l.adoptId)).toEqual([1]);
  });

  it("writes nothing once the page has stopped waiting on the load", async () => {
    const onScreen = makeListing({
      adoptId: 7,
      adoptName: "蓝",
      detailDescription: "一只猫",
    });
    const late = makeListing({
      adoptId: 7,
      adoptName: "青い",
      detailDescription: "猫一匹",
    });
    const r = await mod.mergeListings([onScreen], [late], "ja", () => false);
    expect(r.changed).toBe(false);
    expect(onScreen.adoptName).toBe("蓝");
    expect(await mod.loadListings("ja")).toBeNull();
  });

  it("a reshuffled color list is the same row once the API order is settled", async () => {
    // The API's own order for this list is not fixed - see api.ts.
    const { sortColorsAndPictures } = await import("./api");
    const row = (colors: number[]) =>
      sortColorsAndPictures({
        adoptId: 1,
        paintersId: 1,
        productId: 1,
        harmonyAdoptColorVos: colors.map((colorId) => ({ colorId })),
      });
    const r = await mod.mergeListings([row([4, 1])], [row([1, 4])], "zh");
    expect(r.changed).toBe(false);
  });

  it("the field order in the answer is not a change", async () => {
    const a = {
      adoptId: 1,
      adoptName: "A",
      paintersId: 1,
      productId: 1,
    } as AdoptListing;
    const b = {
      paintersId: 1,
      productId: 1,
      adoptId: 1,
      adoptName: "A",
    } as AdoptListing;
    expect((await mod.mergeListings([a], [b], "zh")).changed).toBe(false);
  });

  it("a name with a question mark is not cut at it", async () => {
    const a = makeListing({ adoptId: 1, adoptName: "这是什么?" });
    const b = makeListing({ adoptId: 1, adoptName: "这是什么" });
    expect((await mod.mergeListings([a], [b], "zh")).changed).toBe(true);
  });

  it("changed when row count differs", async () => {
    const r = await mod.mergeListings([], [makeListing({ adoptId: 1 })], "zh");
    expect(r.changed).toBe(true);
  });

  it("unchanged for identical rows → does not rewrite the table", async () => {
    const rows = [makeListing({ adoptId: 1, adoptName: "A" })];
    await mod.saveListings(rows, "zh");
    const r = await mod.mergeListings(rows, [{ ...rows[0] }], "zh");
    expect(r.changed).toBe(false);
    const loaded = await mod.loadListings("zh");
    expect(loaded!.map((l) => l.adoptId)).toEqual([1]);
  });

  it("a real change rewrites the table with the merged rows", async () => {
    const a = signed(1, "aaa");
    await mod.saveListings([a], "zh");
    const b = makeListing({ adoptId: 2, adoptName: "B" });
    const r = await mod.mergeListings([a], [a, b], "zh");
    expect(r.changed).toBe(true);
    const loaded = await mod.loadListings("zh");
    expect(loaded!.map((l) => l.adoptId)).toEqual([1, 2]);
  });

  // Saving clears the table and writes it again, so half an answer would drop rows from every later
  // visit, offline ones included.
  it("leaves the table alone when a list never answered", async () => {
    const a = signed(1, "aaa");
    const debut = signed(2, "bbb");
    await mod.saveListings([a, debut], "zh");
    const r = await mod.mergeListings([a, debut], [a], "zh", () => true, false);
    expect(r.updated.map((l) => l.adoptId)).toEqual([1]);
    const kept = await mod.loadListings("zh");
    expect(kept!.map((l) => l.adoptId)).toEqual([1, 2]);
  });

  it("lets a full answer drop a row the site no longer holds", async () => {
    const a = signed(1, "aaa");
    const debut = signed(2, "bbb");
    await mod.saveListings([a, debut], "zh");
    await mod.mergeListings([a, debut], [a], "zh", () => true, true);
    const after = await mod.loadListings("zh");
    expect(after!.map((l) => l.adoptId)).toEqual([1]);
  });
});

describe("a new language", () => {
  // The API answers the name, the description and the painter in the language of the request,
  // and nothing else on a row moves. The waterfall keys each card by its row, so a row that keeps
  // its object keeps its picture painted.
  it("keeps the row when only the words the API translates changed", async () => {
    const before = makeListing({
      adoptId: 1,
      adoptName: "名字甲",
      detailDescription: "文字甲",
      nonrecurringExpense: 12345,
      harmonyPainterVo: { painterid: 7, painterName: "画师甲" },
    });
    const after = makeListing({
      adoptId: 1,
      adoptName: "Name A",
      detailDescription: "Text A",
      nonrecurringExpense: 12345,
      harmonyPainterVo: { painterid: 7, painterName: "Painter A" },
    });
    const r = await mod.mergeListings([before], [after], "us");
    expect(r.updated[0]).toBe(before);
    // The cache holds the words too, and the language they were answered in.
    expect(r.changed).toBe(true);
    expect(before.adoptName).toBe("Name A");
    expect(before.harmonyPainterVo?.painterName).toBe("Painter A");
  });

  it("replaces the row when the money moves, words or no words", async () => {
    const before = makeListing({
      adoptId: 1,
      adoptName: "名字甲",
      nonrecurringExpense: 12345,
    });
    const after = makeListing({
      adoptId: 1,
      adoptName: "Name A",
      nonrecurringExpense: 39000,
    });
    const r = await mod.mergeListings([before], [after], "us");
    expect(r.updated[0]).toBe(after);
    expect(r.changed).toBe(true);
  });
});
