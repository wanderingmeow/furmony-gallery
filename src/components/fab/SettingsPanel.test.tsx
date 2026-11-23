// The panel the … circle opens: how the list reads. The order stands with the funnel, beside the
// picks it works with, and nothing here takes a 重置.
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

  it("offers no 重置: nothing here needs undoing after the fact", () => {
    draw();
    expect(host.textContent).not.toContain("重置");
  });

  it("the 设定搜索增强 switch writes to the display store", () => {
    draw();
    switchRow("设定搜索增强").click();
    expect(calls).toEqual(["semantic:true"]);
  });
});
