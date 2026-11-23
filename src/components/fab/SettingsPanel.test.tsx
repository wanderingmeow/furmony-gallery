// The panel the … circle opens: how the list reads. The order stands with the funnel, beside the
// picks it works with, and so does the 重置 that undoes them.
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { SettingsPanel } from "./SettingsPanel";

const calls = vi.hoisted(() => [] as string[]);

vi.mock("../../stores/displayStore", () => ({
  priceMode: () => "once",
  setPriceMode: (v: string) => calls.push(`price:${v}`),
  setSemanticSearch: (v: boolean) => calls.push(`semantic:${v}`),
}));
vi.mock("../../stores/semanticStore", () => ({
  searchConfigured: true,
  semanticActive: () => false,
  semanticOn: () => false,
}));

// The notice row reads both of these.
let silenced = false;
let saved: number[] = [];
vi.mock("../../stores/persistenceStore", () => ({
  promptsSilenced: () => silenced,
  restorePrompts: (hasSavedList: boolean) =>
    calls.push(`restorePrompts(${hasSavedList})`),
}));
vi.mock("../../stores/wishlistStore", () => ({
  wishlist: () => new Map(saved.map((id) => [id, 0])),
}));

let dispose: (() => void) | undefined;
let host: HTMLDivElement;

function draw() {
  dispose?.();
  host?.remove();
  host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(() => SettingsPanel(), host);
}

const switchRow = (label: string) => {
  const sw = host.querySelector<HTMLButtonElement>(
    `button[role="switch"][aria-label="${label}"]`,
  );
  if (!sw) throw new Error(`no switch labeled ${label}`);
  return sw;
};

afterEach(() => {
  dispose?.();
  host?.remove();
  calls.length = 0;
  silenced = false;
  saved = [];
});

describe("SettingsPanel", () => {
  it("reads top to bottom: price display, search switch, language", () => {
    draw();
    const text = host.textContent ?? "";
    const at = ["价格显示", "设定搜索增强", "界面语言"].map((s) =>
      text.indexOf(s),
    );
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it("holds no row the funnel owns: no picks, and no order", () => {
    draw();
    expect(host.textContent).not.toContain("颜色");
    expect(host.textContent).not.toContain("物种");
    expect(host.textContent).not.toContain("排序");
  });

  it("offers no 重置: the funnel owns the row that undoes its picks", () => {
    draw();
    expect(host.textContent).not.toContain("重置");
  });

  it("shows no 恢复所有提示 row while nothing is silenced", () => {
    draw();
    expect(host.textContent).not.toContain("恢复所有提示");
  });

  it("restores the notices, and passes whether the wishlist has entries", () => {
    silenced = true;
    saved = [1];
    draw();
    const row = [...host.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes("恢复所有提示"),
    );
    row?.click();
    expect(calls).toEqual(["restorePrompts(true)"]);
  });

  it("the 设定搜索增强 switch writes to the display store", () => {
    draw();
    switchRow("设定搜索增强").click();
    expect(calls).toEqual(["semantic:true"]);
  });
});
