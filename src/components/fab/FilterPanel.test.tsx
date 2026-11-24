// The panel the funnel opens: what a press sends to the stores, and what the panel draws from what
// the stores answer. The rows that hide no listing live behind the … circle, in SettingsPanel.
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import {
  ArrowUpOutlined,
  ClockCircleOutlined,
  DollarOutlined,
} from "@ant-design/icons-svg";
import { FilterPanel, priceIcon, timeIcon } from "./FilterPanel";

const facts = vi.hoisted(() => ({
  colors: new Set<string>(),
  races: new Set<string>(),
  sort: "timeDesc" as "timeDesc" | "timeAsc" | "priceAsc" | "priceDesc",
  // The state behind the stores this panel reads and writes.
  filterOn: false,
  ready: true,
  semantic: false,
  changed: false,
}));

const calls = vi.hoisted(() => [] as string[]);

vi.mock("../../stores/derivedStore", () => ({
  availableColors: () => ["红", "蓝"],
  availableRaces: () => ["狼", "龙"],
  filtersChanged: () => facts.changed,
  resetFilters: () => calls.push("resetFilters"),
  socialCount: () => 87,
  socialFilterOn: () => facts.filterOn,
  socialsReady: () => facts.ready,
}));
vi.mock("../../stores/filterStore", () => ({
  selectedColors: () => facts.colors,
  // The mocks write what the real store writes, so a press changes what the panel reads next.
  setSelectedColors: (v: Set<string>) => {
    facts.colors = new Set(v);
    calls.push(`colors:${[...v].join(",")}`);
  },
  selectedRaces: () => facts.races,
  setSelectedRaces: (v: Set<string>) => {
    facts.races = new Set(v);
    calls.push(`races:${[...v].join(",")}`);
  },
  setSocialOnly: (v: boolean) => calls.push(`socialOnly:${v}`),
  sortMode: () => facts.sort,
  setSortMode: (v: string) => {
    facts.sort = v as typeof facts.sort;
    calls.push(`sort:${v}`);
  },
  // The semantic store reads the query.
  searchText: () => "",
}));
vi.mock("../../stores/semanticStore", () => ({
  semanticActive: () => facts.semantic,
}));
// The price block draws a histogram and a slider from the derived store, and its own file tests
// what it does with them.
vi.mock("../priceRange", () => ({ PriceRangeBlock: () => null }));

let dispose: (() => void) | undefined;
let host: HTMLDivElement;

function draw() {
  // Calling it twice replaces what is on screen, so a test can change the facts and look again.
  dispose?.();
  host?.remove();
  host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(() => FilterPanel(), host);
}

const button = (text: string) => {
  const found = Array.from(
    host.querySelectorAll<HTMLButtonElement>("button"),
  ).find((b) => b.textContent?.trim() === text);
  if (!found) throw new Error(`no button labeled ${text}`);
  return found;
};

const press = (text: string) => button(text).click();

const pressed = (text: string) => button(text).getAttribute("aria-pressed");

/** The fold rows, as `title:true` or `title:false`. The count sits inside a row's text, so it is
 *  cut off to leave the title. */
const folds = () =>
  Array.from(
    host.querySelectorAll<HTMLButtonElement>("button[aria-expanded]"),
  ).map(
    (b) =>
      `${(b.textContent ?? "").replace(/\d+\/\d+/, "").trim()}` +
      `:${b.getAttribute("aria-expanded")}`,
  );

const chip = (text: string) => {
  const button = Array.from(
    host.querySelectorAll<HTMLButtonElement>("button"),
  ).find((b) => b.textContent?.trim() === text);
  if (!button) throw new Error(`no chip labeled ${text}`);
  button.click();
};

/** The panel has more than one switch, so a test picks the one it needs by name. */
const switchByLabel = (label: string) => {
  const sw = host.querySelector<HTMLButtonElement>(
    `button[role="switch"][aria-label="${label}"]`,
  );
  if (!sw) throw new Error(`no switch labeled ${label}`);
  return sw;
};

const reset = () => {
  const button = Array.from(
    host.querySelectorAll<HTMLButtonElement>("button"),
  ).find((b) => b.textContent?.trim() === "重置");
  if (!button) throw new Error("no reset row");
  return button;
};

/** The lines between blocks. A token match, because `border-t` is also the start of
 *  `border-transparent`. */
const lines = () =>
  Array.from(host.querySelectorAll<HTMLElement>("div")).filter((d) =>
    d.className.split(/\s+/).includes("border-t"),
  ).length;

const foldRows = () =>
  Array.from(host.querySelectorAll<HTMLButtonElement>("button[aria-expanded]"));

const fold = (title: string) => {
  const button = foldRows().find((b) =>
    b.textContent?.trim().startsWith(title),
  );
  if (!button) throw new Error(`no fold row titled ${title}`);
  button.click();
};

afterEach(() => {
  dispose?.();
  host?.remove();
  calls.length = 0;
  facts.colors = new Set();
  facts.races = new Set();
  facts.sort = "timeDesc";
  facts.filterOn = false;
  facts.ready = true;
  facts.semantic = false;
  facts.changed = false;
});

describe("FilterPanel", () => {
  it("reads top to bottom: order, colors, species, owner account, reset", () => {
    facts.changed = true; // 重置 only shows when there is something to give back
    draw();
    const text = host.textContent ?? "";
    const at = ["排序", "颜色", "物种", "只显示有主人账号的", "重置"].map((s) =>
      text.indexOf(s),
    );
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it("hides no display row: the language and the price display live behind …", () => {
    draw();
    expect(host.textContent).not.toContain("界面语言");
    expect(host.textContent).not.toContain("价格显示");
  });

  it("names the order on screen in the 排序 header", () => {
    draw();
    expect(host.textContent).toContain("排序：时间从新到旧");
  });

  it("marks the chip that matches the current order", () => {
    draw();
    expect(pressed("价格")).toBe("false");
    expect(pressed("时间")).toBe("true");
  });

  it("walks the price group and never cancels back to time", () => {
    draw();
    press("价格");
    expect(calls).toEqual(["sort:priceAsc"]);
    press("价格");
    expect(calls).toContain("sort:priceDesc");
    press("价格");
    expect(calls).toContain("sort:priceAsc");
  });

  it("enters the time group at newest first", () => {
    facts.sort = "priceAsc";
    draw();
    press("时间");
    expect(calls).toEqual(["sort:timeDesc"]);
    press("时间");
    expect(calls).toContain("sort:timeAsc");
  });

  // One dead button naming the order, instead of two the user can press and nothing happens.
  it("gives up to 相关性 while a search answer is on screen", () => {
    facts.semantic = true;
    draw();
    expect(host.textContent).toContain("排序：按相似度从高到低");
    const dead = button("相关性");
    expect(dead.disabled).toBe(true);
    expect(dead.className).toContain("text-faint");
    expect(host.textContent).not.toContain("价格");
    expect(host.textContent).not.toContain("时间");
    expect(dead.getAttribute("aria-pressed")).toBe(null);
  });

  it("shows what a press would choose, not a direction, while a search answer is on screen", () => {
    facts.sort = "priceAsc";
    expect(priceIcon()).toBe(ArrowUpOutlined);
    facts.sort = "timeAsc";
    expect(timeIcon()).toBe(ArrowUpOutlined);
    facts.semantic = true;
    expect(priceIcon()).toBe(DollarOutlined);
    expect(timeIcon()).toBe(ClockCircleOutlined);
  });

  it("opens a section at the start only when it already holds a pick", () => {
    draw();
    expect(folds()).toEqual(["颜色:false", "物种:false"]);
    facts.colors = new Set(["红"]);
    draw();
    expect(folds()).toEqual(["颜色:true", "物种:false"]);
  });

  it("flips the 主人账号 filter through the store", () => {
    draw();
    const sw = switchByLabel("只显示有主人账号的");
    expect(sw.getAttribute("aria-checked")).toBe("false");
    expect(sw.disabled).toBe(false);
    sw.click();
    expect(calls).toEqual(["socialOnly:true"]);
  });

  it("names how many listings have an account", () => {
    draw();
    expect(host.textContent).toContain(
      "查得到主人账号的只有 87 只，列表会短很多。",
    );
  });

  // Why the switch reads off even when the stored flag is on: see `socialFilterOn`.
  it("grays the 主人账号 switch when the socials table is not there", () => {
    facts.ready = false;
    draw();
    const sw = switchByLabel("只显示有主人账号的");
    expect(sw.disabled).toBe(true);
    expect(sw.getAttribute("aria-checked")).toBe("false");
    expect(host.textContent).toContain(
      "主人账号的资料没有加载成功，这个筛选暂时用不了。",
    );
    sw.click();
    expect(calls).toEqual([]);
  });

  it("ends the list with 重置 once the store has something to give back", () => {
    facts.changed = true;
    draw();
    expect(reset().textContent?.trim()).toBe("重置");
  });

  it("shows no 重置 row while the store has nothing to give back", () => {
    draw();
    expect(host.textContent).not.toContain("重置");
  });

  it("takes the line above 重置 with the row", () => {
    facts.changed = true;
    draw();
    const withReset = lines();
    facts.changed = false;
    draw();
    expect(lines()).toBe(withReset - 1);
  });

  it("重置 hands only the rows of this panel back to the store", () => {
    facts.changed = true;
    draw();
    reset().click();
    expect(calls).toEqual(["resetFilters"]);
  });

  it("folds from the whole row, count included", () => {
    draw();
    expect(foldRows().length).toBe(2);
    for (const row of foldRows()) {
      expect(row.textContent).toMatch(/\d+\/\d+/);
    }
    expect(folds()).toEqual(["颜色:false", "物种:false"]);
    fold("颜色");
    expect(folds()).toEqual(["颜色:true", "物种:false"]);
  });

  it("keeps a section open after its last pick goes away", () => {
    draw();
    fold("颜色");
    chip("红");
    chip("红");
    expect(pressed("红")).toBe("false");
    expect(folds()).toEqual(["颜色:true", "物种:false"]);
  });
});
