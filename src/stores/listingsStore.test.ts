// What loadData() hands the screen, with the network and the cache held by mocks.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdoptListing } from "../model/types";
import { SELF_COMMISSION_PAINTER_ID } from "../model/domain";

const readCache = vi.fn();
const fetchAllListings = vi.fn();
const mergeListings = vi.fn();
const notifyListingChanges = vi.fn();

vi.mock("../data/listingCache", () => ({
  readCache: () => readCache(),
  mergeListings: (prev: AdoptListing[], next: AdoptListing[]) =>
    mergeListings(prev, next),
}));
vi.mock("../data/api", () => ({ fetchAllListings: () => fetchAllListings() }));
vi.mock("./wishlistStore", () => ({ cleanStaleWishlist: vi.fn() }));
vi.mock("./notificationStore", () => ({
  notifyListingChanges: (a: unknown, b: unknown) => notifyListingChanges(a, b),
}));

const { loadData, listings } = await import("./listingsStore");

const row = (
  adoptId: number,
  painterid: number,
  painterName: string,
): AdoptListing => ({
  adoptId,
  paintersId: 1,
  productId: 1,
  harmonyPainterVo: { painterid, painterName },
});
const listedRow = row(2, 77, "某画师");
const selfRow = row(1, SELF_COMMISSION_PAINTER_ID, "自设委托");
const selfTranslated = row(1, SELF_COMMISSION_PAINTER_ID, "Self commission");

beforeEach(() => {
  readCache.mockReset().mockResolvedValue(null);
  fetchAllListings.mockReset().mockResolvedValue([listedRow]);
  mergeListings
    .mockReset()
    .mockResolvedValue({ updated: [listedRow], changed: true });
  notifyListingChanges.mockReset();
});

describe("loadData", () => {
  it("keeps a self-commission piece out of the rows the page gets", async () => {
    fetchAllListings.mockResolvedValue([selfRow, listedRow]);
    mergeListings.mockResolvedValue({
      updated: [selfRow, listedRow],
      changed: true,
    });
    await loadData();
    expect(listings().map((l) => l.adoptId)).toEqual([2]);
  });

  // The API translates painter names, so the words 「自设委托」 only arrive in Chinese. The id
  // behind them is what stays put across languages.
  it("drops a self-commission piece whose name came back in another language", async () => {
    fetchAllListings.mockResolvedValue([selfTranslated, listedRow]);
    mergeListings.mockResolvedValue({
      updated: [selfTranslated, listedRow],
      changed: true,
    });
    await loadData();
    expect(listings().map((l) => l.adoptId)).toEqual([2]);
  });

  it("applies the same rule to a cache that still holds one", async () => {
    readCache.mockResolvedValue({ rows: [selfRow, listedRow], lang: "zh" });
    mergeListings.mockResolvedValue({ updated: [], changed: false });
    await loadData();
    expect(listings().map((l) => l.adoptId)).toEqual([2]);
  });

  // A notification offers a page the reader could open, so a piece they cannot reach stays out of
  // the comparison on both sides.
  it("leaves self-commission pieces out of the change comparison", async () => {
    readCache.mockResolvedValue({ rows: [listedRow], lang: "zh" });
    fetchAllListings.mockResolvedValue([listedRow, selfRow]);
    mergeListings.mockResolvedValue({
      updated: [listedRow, selfRow],
      changed: true,
    });
    await loadData();
    const call = notifyListingChanges.mock.calls.at(-1);
    expect(call?.[1].map((l: AdoptListing) => l.adoptId)).toEqual([2]);
  });

  // An answer from the language the reader left must not reach the screen.
  it("lets the newest load have the last word", async () => {
    const left = [row(2, 77, "Some artist")];
    const picked = [row(2, 77, "ある画家")];
    let late: (rows: AdoptListing[]) => void = () => {};
    fetchAllListings
      .mockImplementationOnce(
        () =>
          new Promise<AdoptListing[]>((resolve) => {
            late = resolve;
          }),
      )
      .mockImplementationOnce(() => Promise.resolve(picked));
    mergeListings.mockImplementation(
      (_prev: AdoptListing[], next: AdoptListing[]) =>
        Promise.resolve({ updated: next, changed: true }),
    );

    const first = loadData();
    // The first request has to be on its way before the second pick lands.
    await vi.waitFor(() => expect(fetchAllListings).toHaveBeenCalledTimes(1));
    await loadData();
    const names = () => listings().map((l) => l.harmonyPainterVo?.painterName);
    expect(names()).toEqual(["ある画家"]);

    late(left);
    await first;
    expect(names()).toEqual(["ある画家"]);
    expect(notifyListingChanges).toHaveBeenCalledTimes(1);
  });
});
