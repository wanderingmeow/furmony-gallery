// The panel the … circle opens: how the list reads. The order stands with the funnel, beside the
// picks it works with, and so does the 重置 that undoes them.
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { SettingsPanel } from "./SettingsPanel";
import { tr } from "../../i18n";

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

// The notification row: what the build can do, where the switch stands, and what to say.
type PushState = {
  hidden: boolean;
  on: boolean;
  rows: boolean;
  line: string;
  busy: boolean;
  held: boolean;
};

/** The store's answers. The two rows follow the switch unless a test says otherwise, because the
 *  rows are on screen only where the record has answered.
 */
function state(over: Partial<PushState> = {}): PushState {
  const next = {
    hidden: false,
    on: false,
    rows: false,
    line: "",
    busy: false,
    held: false,
    ...over,
  };
  return {
    ...next,
    rows: over.rows ?? over.on ?? false,
    // The store holds the switch while a request is in flight too.
    held: next.held || next.busy,
  };
}

let push = state();
let picks = { new: true, lock: true };
let hint = "";
let guide = "";
vi.mock("../../stores/pushStore", () => ({
  pushHidden: () => push.hidden,
  pushBusy: () => push.busy,
  pushOn: () => push.on,
  pushRows: () => push.rows,
  pushSwitchHeld: () => push.held,
  pushLine: () => push.line,
  pushPicks: () => picks,
  pushHint: () => hint,
  installHelpUrl: () => guide,
  setPick: (which: string, on: boolean) => calls.push(`pick:${which}:${on}`),
  turn: (on: boolean) => {
    calls.push(`turn:${on}`);
    return Promise.resolve();
  },
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
  push = state({ hidden: false, on: false, line: "", busy: false });
  picks = { new: true, lock: true };
  hint = "";
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

  it("leaves the notification row out when this build cannot be asked", () => {
    push = state({ hidden: true, on: false, line: "", busy: false });
    draw();
    expect(host.textContent).not.toContain(tr("push.title"));
  });

  it("shows the row when the build has a service and a key", () => {
    draw();
    expect(host.textContent).toContain(tr("push.title"));
  });

  it("holds the notification switch when the store says it takes no flip", () => {
    push = state({ hidden: false, on: false, held: true });
    draw();
    expect(switchRow(tr("push.title")).disabled).toBe(true);
    switchRow(tr("push.title")).click();
    expect(calls).not.toContain("turn:true");
  });

  it("holds the two picks with the master switch", () => {
    push = state({ hidden: false, on: true, rows: true, held: true });
    draw();
    const held = [tr("push.title"), tr("push.news"), tr("push.lock")].map(
      (label) => switchRow(label).disabled,
    );
    expect(held).toEqual([true, true, true]);
  });

  // The word 新设定 is in the note as well, so the row is the switch, not the text.
  const row = (label: string) =>
    host.querySelector(`button[role="switch"][aria-label="${label}"]`);

  it("shows a switch being worked out without the picks it has not read yet", () => {
    push = state({
      on: true,
      rows: false,
      busy: true,
      line: tr("push.checking"),
    });
    draw();
    expect(row(tr("push.news"))).toBeNull();
    expect(row(tr("push.lock"))).toBeNull();
    expect(host.textContent).toContain(tr("push.checking"));
  });

  it("offers the two kinds of news only while it is on", () => {
    draw();
    expect(row(tr("push.news"))).toBeNull();
    expect(row(tr("push.lock"))).toBeNull();
    push = state({ hidden: false, on: true, line: "", busy: false });
    draw();
    expect(row(tr("push.news"))).not.toBeNull();
    expect(row(tr("push.lock"))).not.toBeNull();
  });

  it("hands a flip of one kind to the store, and not the other", () => {
    push = state({ hidden: false, on: true, line: "", busy: false });
    picks = { new: true, lock: true };
    draw();
    switchRow(tr("push.lock")).click();
    expect(calls).toEqual(["pick:lock:false"]);
  });

  it("carries the reason the service gave under the switch", () => {
    push = state({
      hidden: false,
      on: false,
      line: tr("push.busy"),
      busy: false,
    });
    draw();
    expect(host.textContent).toContain(tr("push.busy"));
  });

  it("says what an iPhone needs before the reader tries it", () => {
    hint = tr("push.installIosLine");
    draw();
    expect(host.textContent).toContain(tr("push.installIosLine"));
  });

  it("links that line to the Apple page this device was given", () => {
    // The line names a menu item the system moves around; the page is the part that keeps up.
    hint = tr("push.installIosLine");
    guide = "https://support.apple.test/iphone";
    draw();
    const link = host.querySelector("a");
    expect(link?.getAttribute("href")).toBe(
      "https://support.apple.test/iphone",
    );
    expect(link?.textContent).toBe(tr("push.installHelp"));
  });

  it("links nothing when the line asks for no install", () => {
    hint = "";
    guide = "";
    draw();
    expect(host.querySelector("a")).toBeNull();
  });

  it("names the Mac action, which is not the Home Screen", () => {
    hint = tr("push.installMacLine");
    draw();
    expect(host.textContent).toContain(tr("push.installMacLine"));
  });

  it("says a browser without web push cannot, rather than telling anyone to retry", () => {
    hint = tr("push.unsupported");
    draw();
    expect(host.textContent).toContain(tr("push.unsupported"));
  });

  it("will not take a flip while the service is still answering", () => {
    push = state({ hidden: false, on: true, line: "", busy: true });
    draw();
    expect(switchRow(tr("push.title")).disabled).toBe(true);
  });

  it("takes a flip again once the answer has landed", () => {
    push = state({ hidden: false, on: true, line: "", busy: false });
    draw();
    expect(switchRow(tr("push.title")).disabled).toBe(false);
  });

  it("gives the flip the line to itself, and does not stack the install hint under it", () => {
    push = state({
      hidden: false,
      on: false,
      line: tr("push.closing"),
      busy: true,
    });
    hint = tr("push.installIosLine");
    draw();
    expect(host.textContent).toContain(tr("push.closing"));
    expect(host.textContent).not.toContain(tr("push.installIosLine"));
  });

  it("says none of that to a browser that can be woken up from a tab", () => {
    draw();
    expect(host.textContent).not.toContain(tr("push.installIosLine"));
    expect(host.textContent).not.toContain(tr("push.installMacLine"));
    expect(host.textContent).not.toContain(tr("push.unsupported"));
  });
});
