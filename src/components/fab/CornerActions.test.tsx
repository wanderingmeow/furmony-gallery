import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { CornerActions } from "./CornerActions";

const facts = vi.hoisted(() => ({ count: 0, semantic: false }));

vi.mock("./FilterPanel", () => ({
  FilterPanel: () => <div>filter-panel</div>,
}));
vi.mock("./SettingsPanel", () => ({
  SettingsPanel: () => <div>settings-panel</div>,
}));
vi.mock("../../stores/derivedStore", () => ({
  filtersOnCount: () => facts.count,
}));
vi.mock("../../stores/filterStore", () => ({ sortMode: () => "timeDesc" }));
vi.mock("../../stores/semanticStore", () => ({
  semanticActive: () => facts.semantic,
}));

let dispose: (() => void) | undefined;
let host: HTMLDivElement;

const circle = (label: string) => {
  const button = host.querySelector<HTMLButtonElement>(
    `button[aria-label^="${label}"]`,
  );
  if (!button) throw new Error(`no ${label} circle`);
  return button;
};
const funnel = () => circle("排序");
const more = () => circle("更多");

/** The number at the corner, or null when there is nothing to count. Read off the whole button:
 *  the mark draws no text, so the only text there is the number. */
const badge = () => {
  const text = funnel().textContent?.trim() ?? "";
  return text === "" ? null : text;
};

/** The composite order mark: a glyph under a diagonal mask, with the arrow in front of it. */
const mark = () =>
  funnel().querySelector<HTMLElement>('[aria-hidden="true"] [style]');

const shown = (text: string) =>
  document.body.textContent?.includes(text) ?? false;

function draw() {
  // the facts are plain objects, so a redraw has to replace what is on screen
  dispose?.();
  host?.remove();
  document.body.textContent = "";
  host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(() => <CornerActions />, host);
}

beforeEach(() => {
  facts.count = 0;
  facts.semantic = false;
});

afterEach(() => {
  dispose?.();
  host?.remove();
});

describe("the funnel", () => {
  it("wears the order in one mark", () => {
    draw();
    expect(mark()?.style.getPropertyValue("mask-image")).toContain(
      "linear-gradient",
    );
  });

  it("gives the face to the funnel while a model ranks the answer", () => {
    facts.semantic = true;
    draw();
    expect(mark()).toBeNull();
    expect(funnel().querySelector("svg")).toBeTruthy();
  });

  it("names the order on screen, and follows it", () => {
    draw();
    expect(funnel().getAttribute("aria-label")).toBe("排序：时间从新到旧");
  });

  it("shows the number the store counts", () => {
    facts.count = 3;
    draw();
    expect(badge()).toBe("3");
  });

  it("shows no number when nothing is on", () => {
    draw();
    expect(badge()).toBeNull();
  });

  it("is plain until its panel opens", () => {
    facts.count = 2;
    draw();
    expect(funnel().className).not.toContain("bg-accent");
    funnel().click();
    expect(funnel().className).toContain("bg-accent");
    expect(badge()).toBe("2");
  });

  it("opens the rows that hide listings", () => {
    draw();
    funnel().click();
    expect(shown("filter-panel")).toBe(true);
  });
});

describe("the … circle", () => {
  it("opens the rows that hide nothing", () => {
    draw();
    more().click();
    expect(shown("settings-panel")).toBe(true);
  });

  it("asks for no number, because its rows hide no listing", () => {
    facts.count = 4;
    draw();
    expect(more().textContent?.trim()).toBe("");
  });

  it("opens on its own: one circle's panel is not the other's", () => {
    draw();
    funnel().click();
    expect(shown("settings-panel")).toBe(false);
    more().click();
    expect(shown("filter-panel")).toBe(false);
  });

  it("stands on the funnel's left, where the edge gives it back to the box", () => {
    draw();
    expect(
      (more().closest("[data-chrome]") as HTMLElement).dataset.chrome,
    ).toBe("more");
  });
});

describe("Escape on an open panel", () => {
  it("closes the panel and stops there", () => {
    // The band behind reads the same key as "leave picture mode", so the panel keeps it.
    const seen: string[] = [];
    const onWindow = (e: KeyboardEvent): void => {
      seen.push(e.key);
    };
    window.addEventListener("keydown", onWindow);
    draw();
    funnel().click();
    expect(shown("filter-panel")).toBe(true);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    window.removeEventListener("keydown", onWindow);
    expect(shown("filter-panel")).toBe(false);
    expect(seen).toEqual([]);
  });
});
