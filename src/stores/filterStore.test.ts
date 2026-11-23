import { beforeEach, describe, expect, it } from "vitest";
import {
  loadFilters,
  priceRange,
  selectedColors,
  selectedRaces,
  holdPriceBand,
  releasePriceBand,
  setOnFilterChange,
  setPriceRange,
  setSearchText,
  setSelectedColors,
  setSelectedRaces,
  setSocialOnly,
  searchText,
  socialOnly,
} from "./filterStore";

const KEY = "furmony_filter";

describe("the stored query", () => {
  beforeEach(() => {
    localStorage.removeItem(KEY);
    setSearchText("");
  });

  it("restores the query the reader left behind", () => {
    localStorage.setItem(KEY, JSON.stringify({ search: "蓝色的猫" }));
    loadFilters();
    expect(searchText()).toBe("蓝色的猫");
  });

  // A query stored before the input gate existed: the box can hold syllables nobody committed.
  it("drops a stored query that still holds uncommitted syllables", () => {
    setSearchText("苍雪蓝眼睛");
    localStorage.setItem(
      KEY,
      JSON.stringify({ search: "cang\u2006xue\u2006lan" }),
    );
    loadFilters();
    expect(searchText()).toBe("苍雪蓝眼睛");
  });
});

describe("the stored picks", () => {
  beforeEach(() => {
    localStorage.removeItem(KEY);
    setSelectedColors(new Set());
    setSelectedRaces(new Set());
  });

  it("restores picks the shelf still sends", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ colors: ["蓝"], races: ["犬"] }),
    );
    loadFilters();
    expect([...selectedColors()]).toEqual(["蓝"]);
    expect([...selectedRaces()]).toEqual(["犬"]);
  });

  // A pick with no chip in the panel would filter the list with nothing left to tap, and stored
  // filters are not worth a migration over that.
  it("drops a stored name the shelf no longer sends", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ colors: ["蓝", "虹彩"], races: ["犬", "凤凰"] }),
    );
    loadFilters();
    expect([...selectedColors()]).toEqual(["蓝"]);
    expect([...selectedRaces()]).toEqual(["犬"]);
  });

  it("drops a stored list that holds anything the shelf never sends", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ colors: [null, 7, {}], races: [""] }),
    );
    loadFilters();
    expect(selectedColors().size).toBe(0);
    expect(selectedRaces().size).toBe(0);
  });
});

describe("the stored 主人账号 switch", () => {
  beforeEach(() => {
    localStorage.removeItem(KEY);
    setSocialOnly(false);
  });

  it("restores the switch the reader left behind", () => {
    localStorage.setItem(KEY, JSON.stringify({ socialOnly: true }));
    loadFilters();
    expect(socialOnly()).toBe(true);
  });
});

describe("the price band the list runs with", () => {
  let seen: string[];
  const stored = () => JSON.parse(localStorage.getItem(KEY) ?? "{}").price;

  beforeEach(() => {
    localStorage.removeItem(KEY);
    seen = [];
    setOnFilterChange((kind) => seen.push(kind));
    setPriceRange(null);
    seen = [];
  });

  // A drag writes on every move, and most moves land back on the pair already in force.
  it("takes no notice of a pair that keeps the same rows", () => {
    setPriceRange([100, 500]);
    seen = [];
    const before = localStorage.getItem(KEY);
    setPriceRange([100, 500]);
    expect(priceRange()).toEqual([100, 500]);
    expect(seen).toEqual([]);
    expect(localStorage.getItem(KEY)).toBe(before);
  });

  it("takes notice of a pair that keeps different rows", () => {
    setPriceRange([100, 500]);
    seen = [];
    setPriceRange([120, 500]);
    expect(seen).toEqual(["priceRange"]);
    expect(stored()).toEqual([120, 500]);
  });

  it("clears once: a second 全区间 is no news", () => {
    setPriceRange([100, 500]);
    setPriceRange(null);
    seen = [];
    setPriceRange(null);
    expect(seen).toEqual([]);
    expect(stored()).toBeNull();
  });

  // A drag moves the list on every step and writes the disk once.
  it("holds the stored pair down while a gesture runs", () => {
    holdPriceBand();
    setPriceRange([100, 500]);
    expect(priceRange()).toEqual([100, 500]);
    expect(localStorage.getItem(KEY)).toBeNull();
    releasePriceBand();
    expect(JSON.parse(localStorage.getItem(KEY) ?? "{}").price).toEqual([
      100, 500,
    ]);
  });

  it("writes nothing on a release nobody asked for", () => {
    const before = localStorage.getItem(KEY);
    releasePriceBand();
    expect(localStorage.getItem(KEY)).toBe(before);
  });
});
