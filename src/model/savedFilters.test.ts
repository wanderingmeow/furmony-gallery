import { describe, expect, it } from "vitest";
import { RACES } from "../i18n/glossary";
import { readSavedFilters } from "./savedFilters";

const save = (f: Record<string, unknown>): string => JSON.stringify(f);
const aRace = Object.values(RACES)[0].zh;

describe("what a saved filter blob may say", () => {
  it("takes everything a complete save says", () => {
    const f = readSavedFilters(
      save({
        tab: "locked",
        sort: "priceAsc",
        colors: ["红", "黑"],
        races: [aRace],
        search: "黑龙",
        socialOnly: true,
        price: [10, 90],
      }),
    );
    expect(f).toEqual({
      tab: "locked",
      sort: "priceAsc",
      colors: ["红", "黑"],
      races: [aRace],
      search: "黑龙",
      socialOnly: true,
      price: [10, 90],
    });
  });

  it("says nothing about parts the save left out", () => {
    expect(readSavedFilters(save({}))).toEqual({
      colors: [],
      races: [],
      socialOnly: false,
    });
  });

  it("ignores a tab and an order the page does not have", () => {
    const f = readSavedFilters(save({ tab: "sold-out", sort: "random" }));
    expect(f.tab).toBeUndefined();
    expect(f.sort).toBeUndefined();
  });

  it("drops a picked name the shelf no longer sends", () => {
    const f = readSavedFilters(
      save({ colors: ["红", "荧光粉"], races: ["一个下架的种族"] }),
    );
    expect(f.colors).toEqual(["红"]);
    expect(f.races).toEqual([]);
  });

  it("treats a pick that is not a list as no pick", () => {
    expect(readSavedFilters(save({ colors: "红" })).colors).toEqual([]);
    expect(readSavedFilters(save({ races: 7 })).races).toEqual([]);
  });

  it("refuses a query that still holds uncommitted syllables", () => {
    expect(
      readSavedFilters(save({ search: "黑\u2006" })).search,
    ).toBeUndefined();
    expect(readSavedFilters(save({ search: "黑龙" })).search).toBe("黑龙");
    expect(readSavedFilters(save({ search: 12 })).search).toBeUndefined();
  });

  it("reads only a range of two numbers in order", () => {
    expect(readSavedFilters(save({ price: [10, 90] })).price).toEqual([10, 90]);
    expect(readSavedFilters(save({ price: [90, 10] })).price).toBeUndefined();
    expect(readSavedFilters(save({ price: [10] })).price).toBeUndefined();
    expect(readSavedFilters(save({ price: [10, "90"] })).price).toBeUndefined();
    expect(
      readSavedFilters(save({ price: [Number.NaN, 90] })).price,
    ).toBeUndefined();
  });

  it("throws with a save that is not JSON", () => {
    expect(() => readSavedFilters("{")).toThrow();
  });

  it("reads a save whose shape is not an object as nothing", () => {
    expect(readSavedFilters("null")).toEqual({
      colors: [],
      races: [],
      socialOnly: false,
    });
  });
});
