import { beforeEach, describe, expect, it } from "vitest";
import {
  loadFilters,
  selectedColors,
  selectedRaces,
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
