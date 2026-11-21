import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { TabPill } from "./TabPill";
import type { FilterTab } from "../../model/filter";

const state = vi.hoisted(() => ({
  tab: "all" as FilterTab,
  counts: { all: 1094, unlocked: 568, locked: 521, wishlist: 12 },
}));
const calls = vi.hoisted(() => [] as string[]);

vi.mock("../../stores/filterStore", () => ({
  tab: () => state.tab,
  setTab: (v: FilterTab) => calls.push(`tab:${v}`),
}));

vi.mock("../../stores/derivedStore", () => ({
  countAll: () => state.counts.all,
  countUnlocked: () => state.counts.unlocked,
  countLocked: () => state.counts.locked,
  wishlistCount: () => state.counts.wishlist,
}));

let dispose: (() => void) | undefined;
let host: HTMLDivElement;

function draw(tab: FilterTab = "all"): void {
  state.tab = tab;
  calls.length = 0;
  host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(() => <TabPill />, host);
}

function segments(): HTMLInputElement[] {
  return Array.from(host.querySelectorAll('input[type="radio"]'));
}

afterEach(() => {
  dispose?.();
  host?.remove();
});

describe("TabPill", () => {
  it("shows the four tabs in the order the user expects", () => {
    draw();
    expect(segments().map((s) => s.value)).toEqual([
      "all",
      "unlocked",
      "locked",
      "wishlist",
    ]);
    expect(host.textContent).toContain("全部");
    expect(host.textContent).toContain("1094");
  });

  it("marks one segment as chosen, and only that one", () => {
    draw("locked");
    expect(
      segments()
        .filter((s) => s.checked)
        .map((s) => s.value),
    ).toEqual(["locked"]);
  });

  it("writes the tab to the store when a segment is pressed", () => {
    draw();
    const wishlist = segments()[3];
    wishlist.checked = true;
    wishlist.dispatchEvent(new Event("change", { bubbles: true }));
    expect(calls).toEqual(["tab:wishlist"]);
  });

  it("stacks the count under the label, which is what keeps the pill inside 320px", () => {
    draw();
    for (const label of host.querySelectorAll("label")) {
      expect(label.querySelectorAll("span")).toHaveLength(2);
    }
  });
});
