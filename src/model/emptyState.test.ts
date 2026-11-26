import { describe, expect, it } from "vitest";
import {
  emptyActionLabel,
  pickEmptyState,
  type EmptyFacts,
  type EmptyState,
} from "./emptyState";

const none: EmptyFacts = {
  loadFailed: false,
  asking: false,
  socialOnly: false,
  debutOnly: false,
  onWishlistTab: false,
  savedCount: 0,
  query: "",
  picked: 0,
  filtersAreTheCause: false,
  sentenceFailed: false,
  pictureSay: null,
};

const pick = (over: Partial<EmptyFacts>): EmptyState => {
  const s = pickEmptyState({ ...none, ...over });
  if (!s) throw new Error("expected a state");
  return s;
};

describe("pickEmptyState", () => {
  it("says nothing while the enhanced search is still running", () => {
    // A title that names the search word would be a guess about a reply that has not landed.
    expect(pickEmptyState({ ...none, asking: true, query: "狼" })).toBeNull();
  });

  it("says a load failed before anything else", () => {
    // A list that never arrived looks like every other empty list, and the retry button is the only
    // way out.
    const s = pick({
      loadFailed: true,
      query: "狼",
      picked: 3,
      onWishlistTab: true,
    });
    expect(s.title).toBe("没能载入设定");
    expect(s.action).toBe("retry");
  });

  it("names the 主人账号 filter, and the way to switch it off", () => {
    const s = pick({ socialOnly: true });
    expect(s.title).toBe("没有查到主人账号的设定");
    // No line: the switch is the whole reason, so a second sentence would only repeat it.
    expect(s.line).toBeUndefined();
    expect(s.action).toBe("socialOnly");
  });

  it("names the 出场照 filter, and the way to switch it off", () => {
    const s = pick({ debutOnly: true });
    expect(s.title).toBe("没有查到出场照的设定");
    expect(s.action).toBe("debutOnly");
  });

  it("says an empty wishlist on its own, with nothing to press", () => {
    const s = pick({ onWishlistTab: true, savedCount: 0 });
    expect(s.icon).toBe("heart");
    expect(s.title).toBe("还没有收藏");
    // The tab pills stay on screen, so a way out would sit under the reader's eye already.
    expect(s.line).toBeUndefined();
    expect(s.action).toBeUndefined();
  });

  it("leaves a wishlist with things in it to the other cases", () => {
    // Two saved listings and a query that matches neither: the query explains the empty list.
    const s = pick({ onWishlistTab: true, savedCount: 2, query: "龙" });
    expect(s.title).toContain("龙");
  });

  it("names a search that found nothing", () => {
    const s = pick({ query: "机械狼" });
    expect(s.icon).toBe("search");
    expect(s.title).toBe("没有「机械狼」相关设定");
    expect(s.action).toBe("search");
  });

  it("blames the picks when the words alone would have matched", () => {
    const s = pick({ query: "狼", picked: 2, filtersAreTheCause: true });
    expect(s.title).toBe("当前筛选下没有设定");
    expect(s.action).toBe("filters");
  });

  it("blames the words when even the picks off leaves nothing", () => {
    const s = pick({ query: "狼", picked: 2, filtersAreTheCause: false });
    expect(s.title).toBe("没有「狼」相关设定");
    expect(s.action).toBe("search");
  });

  it("blames the service when its request ended with nothing in hand", () => {
    // The words were never looked at, so a line that suggests another word would send the reader off
    // the wrong path.
    const s = pick({
      query: "狼",
      picked: 2,
      filtersAreTheCause: true,
      sentenceFailed: true,
    });
    expect(s.icon).toBe("spark");
    expect(s.title).toBe("增强搜索失败");
    expect(s.action).toBe("retryAsk");
  });

  it("keeps a load failure and the picture search ahead of the failed ask", () => {
    expect(pick({ loadFailed: true, sentenceFailed: true }).title).toBe(
      "没能载入设定",
    );
    expect(pick({ pictureSay: "noMatch", sentenceFailed: true }).title).toBe(
      "没有很像的",
    );
  });

  it("holds the order the reasons are told in", () => {
    expect(
      pickEmptyState({ ...none, asking: true, loadFailed: true }),
    ).toBeNull();
    expect(pick({ loadFailed: true, socialOnly: true }).title).toBe(
      "没能载入设定",
    );
    expect(
      pick({ socialOnly: true, onWishlistTab: true, savedCount: 0 }).title,
    ).toBe("没有查到主人账号的设定");
    expect(
      pick({ onWishlistTab: true, savedCount: 0, query: "狼" }).title,
    ).toBe("还没有收藏");
    expect(pick({ pictureSay: "failed", query: "狼" }).title).toBe(
      "没找到结果",
    );
    expect(pick({ sentenceFailed: true, query: "狼", picked: 3 }).title).toBe(
      "增强搜索失败",
    );
    expect(
      pick({ query: "狼", picked: 3, filtersAreTheCause: true }).title,
    ).toBe("当前筛选下没有设定");
  });

  it("shortens a sentence that would run past the line", () => {
    const s = pick({ query: "一".repeat(40) });
    expect(s.title.length).toBeLessThan(30);
    expect(s.title).toContain("…");
  });

  it("speaks for the picture search without a button", () => {
    // The picture banner already carries the chips, so a second set of buttons would repeat what is
    // already on screen.
    const s = pick({ pictureSay: "noMatch" });
    expect(s.title).toBe("没有很像的");
    expect(s.action).toBeUndefined();
  });

  it("tells a failed picture search from one that found nothing", () => {
    expect(pick({ pictureSay: "failed" }).title).toBe("没找到结果");
  });

  it("blames the filters when they are all that is left", () => {
    const s = pick({ picked: 3 });
    expect(s.icon).toBe("filter");
    expect(s.title).toBe("当前筛选下没有设定");
    expect(s.line).toBeUndefined();
    expect(s.action).toBe("filters");
  });

  it("has something to say when nothing else applies", () => {
    const s = pick({});
    expect(s.title).toBe("没有可显示的设定");
    // Nothing failed here, so the one move left is to try again.
    expect(s.action).toBe("retry");
  });

  it("has a label for every action it can name", () => {
    const actions = new Set(
      [
        {},
        { loadFailed: true },
        { socialOnly: true },
        { debutOnly: true },
        { pictureSay: "noMatch" },
        { query: "x" },
        { picked: 1 },
      ]
        .map((over) => pick(over as Partial<EmptyFacts>).action)
        .filter(Boolean),
    );
    for (const a of actions)
      expect(emptyActionLabel(a!).length).toBeGreaterThan(0);
  });
});
