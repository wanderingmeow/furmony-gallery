// What the grid reads from the derived store, checked where several filters meet: a photograph's
// answer across the tabs, the 主人账号 switch, the price range, and what 重置 gives back.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { settled } from "../testSetup";
import { requestedLocale, setLocale } from "../i18n";
import {
  priceMode,
  semanticSearch,
  setPriceMode,
  setSemanticSearch,
} from "./displayStore";
import {
  priceRange,
  setPriceRange,
  setSocialOnly,
  setSelectedColors,
  setSelectedRaces,
  setSortMode,
  setTab,
  sortMode,
} from "./filterStore";
import { setListings } from "./listingsStore";
import { loadSocials } from "./socialsStore";
import type { AdoptListing } from "../model/types";

vi.mock("../data/searchApi", async (importOriginal) => {
  const real = await importOriginal<typeof import("../data/searchApi")>();
  return {
    ...real,
    searchConfigured: true,
    askPicture: () => Promise.resolve({ ids: [201, 7], box: null }),
  };
});

// The re-encode is the browser's work. The store only needs a blob back.
vi.mock("../data/pictureInput", () => ({
  prepare: async (file: Blob) => ({ blob: file }),
}));

const { picture, pictureAnswers } = await import("./semanticStore");
const {
  applyEmptyAction,
  availableColors,
  availableRaces,
  emptyState,
  filteredListings,
  filtersOnCount,
  listFilterBase,
  panelHasChanges,
  price,
  resetPanel,
  socialCount,
  socialsReady,
} = await import("./derivedStore");

const listing = (id: number): AdoptListing => ({
  adoptId: id,
  paintersId: 1,
  productId: 1,
});
const priced = (id: number, price: number): AdoptListing => ({
  ...listing(id),
  nonrecurringExpense: price,
});
const locked = (id: number, price: number): AdoptListing => ({
  ...priced(id, price),
  isLock: 2,
});

beforeEach(() => {
  // The panel's picks are module state, so each test starts from the page's own state. The mount
  // call is what the panel does when it opens, and it decides whether to hold an empty bar.
  resetPanel();
  picture.close();
  setTab("all");
  setSemanticSearch(true);
  price.remount();
});

describe("the tabs a picture answers across", () => {
  it("leaves the tab in charge while the drop zone is still empty", () => {
    setTab("locked");
    picture.open();
    expect(pictureAnswers()).toBe(false);
    expect(listFilterBase().tab).toBe("locked");
  });

  it("opens the tab out once the picture has answered", async () => {
    setTab("locked");
    picture.open();
    await picture.stage(new Blob(["jpeg-ish"]));
    await settled();
    expect(pictureAnswers()).toBe(true);
    expect(listFilterBase().tab).toBe("all");
  });

  it("hands the tab back when the picture leaves", async () => {
    setTab("wishlist");
    picture.open();
    await picture.stage(new Blob(["jpeg-ish"]));
    await settled();
    picture.close();
    await settled();
    expect(pictureAnswers()).toBe(false);
    expect(listFilterBase().tab).toBe("wishlist");
  });
});

describe("emptyState", () => {
  it("names the wishlist while the tab row is on screen", () => {
    setTab("wishlist");
    expect(emptyState()?.title).toBe("还没有收藏");
  });

  it("speaks for the picture once it answers", async () => {
    setTab("wishlist");
    picture.open();
    await picture.stage(new Blob(["jpeg-ish"]));
    await settled();
    expect(emptyState()?.title).toBe("没有可显示的设定");
  });
});

// The owner-account table is fetched at runtime, so this file starts with none of it. That is
// exactly the state where the switch has to refuse to run.
describe("the 主人账号 filter", () => {
  it("does not run while socials.json has brought nothing in", () => {
    setSocialOnly(true);
    expect(socialsReady()).toBe(false);
    expect(listFilterBase().socialOnly).toBe(false);
    // The list is empty for another reason, so the box must not name the switch.
    expect(emptyState()?.action).not.toBe("socialOnly");
  });

  it("runs once the table arrives, and stops when the switch goes off", async () => {
    // One owner with one account we can link to, served the way socials.json is.
    vi.stubGlobal(
      "fetch",
      () =>
        new Response(
          JSON.stringify({
            164: { ownerName: "TestOwner", platforms: { x: "testhandle" } },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    await loadSocials();
    setSocialOnly(true);
    expect(socialsReady()).toBe(true);
    expect(listFilterBase().socialOnly).toBe(true);
    expect(emptyState()?.title).toBe("没有查到主人账号的设定");
    expect(emptyState()?.action).toBe("socialOnly");

    setSocialOnly(false);
    expect(listFilterBase().socialOnly).toBe(false);
  });

  // The panel names this number before the switch cuts the list down to it, so it counts only
  // the listings the reader can actually reach.
  it("counts the listings on the shelf that have an account", () => {
    setListings([listing(164), listing(999)]);
    expect(socialCount()).toBe(1);
  });

  it("counts the filters the corner number shows", () => {
    setSelectedColors(new Set(["红", "蓝"]));
    setSelectedRaces(new Set(["狼"]));
    setSocialOnly(true);
    expect(filtersOnCount()).toBe(4);
  });

  // 重置 gives back every row the panel offers, not only the ones the corner number counts. A
  // changed order or price display hides no listing, so the number stays empty without them.
  it("重置 returns every setting the panel holds", () => {
    setSortMode("priceAsc");
    setPriceMode("hidden");
    setSemanticSearch(true);
    setLocale("ja");
    expect(panelHasChanges()).toBe(true);

    resetPanel();
    expect(filtersOnCount()).toBe(0);
    expect(sortMode()).toBe("timeDesc");
    expect(priceMode()).toBe("once");
    expect(semanticSearch()).toBe(false);
    // The language goes back to the one the browser asked for, which is what the suite stands on.
    expect(requestedLocale()).toBe("zh");
    // With nothing changed, the row goes gray again.
    expect(panelHasChanges()).toBe(false);
  });
});

// The prices here are the sizes the reader meets on the shelf.
describe("the price range", () => {
  it("reads a range that still covers the shelf as no range at all", () => {
    setListings([priced(1, 20000), priced(2, 26000)]);
    setPriceRange([20000, 27000]);
    expect(price.full()).toEqual([20000, 27000]);
    expect(price.on()).toBe(false);
    expect(listFilterBase().priceRange).toBeNull();
    expect(filtersOnCount()).toBe(0);
  });

  it("keeps the rows between the ends, both ends included", () => {
    setListings([priced(1, 20000), priced(2, 22000), priced(3, 26000)]);
    setPriceRange([20000, 22000]);
    expect(price.on()).toBe(true);
    expect(price.count()).toBe(2);
    // The page's own order: newest first.
    expect(filteredListings().map((l) => l.adoptId)).toEqual([2, 1]);
    expect(filtersOnCount()).toBe(1);
  });

  it("leaves the listings with no price out", () => {
    setListings([priced(1, 21000), priced(3, 61000), listing(2)]);
    setPriceRange([20000, 22000]);
    expect(price.on()).toBe(true);
    expect(filteredListings().map((l) => l.adoptId)).toEqual([1]);
  });

  it("重置 hands the range back with the rest", () => {
    setListings([priced(1, 20000), priced(2, 60000)]);
    setPriceRange([20000, 22000]);
    expect(panelHasChanges()).toBe(true);
    resetPanel();
    expect(priceRange()).toBeNull();
    expect(listFilterBase().priceRange).toBeNull();
  });

  // A bin can hold nothing: the shelf has gaps. The box then names the picks, and its button takes
  // the range back along with the colors and the species.
  it("blames the picks when the range leaves an empty bin", () => {
    setListings([priced(1, 20000), priced(2, 60000)]);
    setPriceRange([22000, 24000]);
    expect(price.on()).toBe(true);
    expect(emptyState()?.title).toBe("当前筛选下没有设定");
    expect(emptyState()?.action).toBe("filters");
    applyEmptyAction("filters");
    expect(priceRange()).toBeNull();
  });

  it("draws the tab the reader is on", () => {
    setPriceRange(null);
    setListings([priced(1, 21000), locked(2, 61000), locked(3, 65000)]);
    setTab("all");
    expect(price.full()).toEqual([21000, 66000]);
    setTab("locked");
    expect(price.full()).toEqual([61000, 66000]);
    expect(price.bars().reduce((n, b) => n + b.count, 0)).toBe(2);
  });

  // The shelf's most expensive piece is locked, so the 未锁定 tab stops well below the band.
  it("gives a band the new tab cannot hold a bar of its own", () => {
    setPriceRange(null);
    setListings([priced(1, 21000), priced(2, 49000), locked(3, 61000)]);
    setPriceRange([57000, 68000]);
    setTab("all");
    expect(price.count()).toBe(1);

    // A tab change closes the panel, so the next look at the block is a fresh mount.
    setTab("unlocked");
    price.remount();

    // The pair the reader chose stays, and one empty bar beyond this tab's top holds it.
    expect(price.effective()).toEqual([57000, 68000]);
    expect(price.full()).toEqual([21000, 51000]);
    expect(price.bars().at(-1)!.count).toBe(0);
    expect(price.count()).toBe(0);
    expect(filteredListings()).toHaveLength(0);
  });

  // The grid keeps its shape for the length of the visit, so a drag never moves the bars under a
  // thumb that is mid-drag.
  it("holds the empty bar until the block mounts again", () => {
    setPriceRange(null);
    setListings([priced(1, 21000), priced(2, 49000), locked(3, 61000)]);
    setPriceRange([57000, 68000]);
    setTab("unlocked");
    price.remount();
    expect(price.full()).toEqual([21000, 51000]);

    setPriceRange([21000, 25000]);
    expect(price.full()).toEqual([21000, 51000]);
    price.remount();
    expect(price.full()).toEqual([21000, 50000]);
  });

  it("counts what the range keeps inside the tab", () => {
    setPriceRange(null);
    setListings([
      priced(1, 21000),
      priced(2, 23000),
      locked(3, 22000),
      locked(4, 24000),
    ]);
    setPriceRange([21000, 23000]);
    setTab("all");
    expect(price.count()).toBe(3);
    setTab("locked");
    expect(price.count()).toBe(1);
  });

  it("keeps the scale and the band while a pick leaves nothing to show", () => {
    setPriceRange(null);
    setListings([
      { ...priced(1, 21000), harmonyRace: { raceName: "狼" } },
      { ...priced(2, 61000), harmonyRace: { raceName: "狼" } },
      { ...priced(3, 31000), harmonyRace: { raceName: "猫" } },
    ]);
    setPriceRange([21000, 22000]);
    const full = price.full();
    const bars = price.bars().length;
    expect(price.count()).toBe(1);

    setSelectedRaces(new Set(["猫"]));

    // The band the reader set stays on screen at the same scale, and says it now keeps nothing.
    expect(price.full()).toEqual(full);
    expect(price.bars().length).toBe(bars);
    expect(price.count()).toBe(0);
    expect(filteredListings()).toHaveLength(0);
  });

  it("leaves the bars where they are while a thumb moves", () => {
    setPriceRange(null);
    setListings([priced(1, 21000), priced(2, 23000), priced(3, 61000)]);
    const before = price.bars().map((b) => b.count);
    setPriceRange([21000, 22000]);
    expect(price.bars().map((b) => b.count)).toEqual(before);
    expect(filteredListings().map((l) => l.adoptId)).toEqual([1]);
  });
});

describe("the panel's color and species lists", () => {
  it("comes in the order a reader scans", async () => {
    setListings([
      {
        ...listing(1),
        raceId: 26,
        harmonyAdoptColorVos: [{ harmonyColor: { colorName: "白" } }],
      },
      {
        ...listing(2),
        raceId: 2,
        harmonyAdoptColorVos: [{ harmonyColor: { colorName: "蓝" } }],
      },
      {
        ...listing(3),
        raceId: 7,
        harmonyAdoptColorVos: [{ harmonyColor: { colorName: "粉" } }],
      },
      {
        ...listing(4),
        raceId: 8,
        harmonyAdoptColorVos: [{ harmonyColor: { colorName: "红" } }],
      },
    ]);
    await settled();
    // Around the wheel, and the grays after it; the dog family, then the cat family, then dragons.
    expect(availableColors()).toEqual(["红", "粉", "蓝", "白"]);
    expect(availableRaces()).toEqual(["犬", "猫", "龙", "神秘生物"]);
  });

  it("lists a species for every bar the chart counts", async () => {
    // No row here carries raceId 26; the bar and the pick come from the row with no species at all.
    setListings([listing(1), { ...listing(2), raceId: 7 }]);
    await settled();
    expect(availableRaces()).toEqual(["犬", "神秘生物"]);
  });
});
