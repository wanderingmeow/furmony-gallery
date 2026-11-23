import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settled } from "../../testSetup";
import { tr } from "../../i18n";
import { ListChrome } from "./ListChrome";
import { searchText, setSearchText } from "../../stores/filterStore";

// the band's charts circle calls useNavigate
vi.mock("@solidjs/router", () => ({ useNavigate: () => () => {} }));

let host!: HTMLDivElement;
let disposeApp!: () => void;

const field = () => host.querySelector('[data-chrome="field"]') as HTMLElement;
const band = () => host.querySelector('[data-chrome="band"]') as HTMLElement;
const input = () => field().querySelector("input") as HTMLInputElement;
const act = (label: string) =>
  host.querySelector(
    `[data-chrome="acts"] [aria-label="${label}"]`,
  ) as HTMLButtonElement;
const hit = () => host.querySelector('[data-chrome="hit"]') as HTMLElement;
const standing = () =>
  !!(history.state as { searchStand?: boolean } | null)?.searchStand;

// a query the last visit left behind opens the box on mount
function mountWithQuery(): void {
  setSearchText("猫");
  disposeApp = render(() => <ListChrome />, host);
}

// nothing searched: the box starts shut
function mountEmpty(): void {
  setSearchText("");
  disposeApp = render(() => <ListChrome />, host);
}

beforeEach(() => {
  history.replaceState(null, "");
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(() => {
  disposeApp();
  host.remove();
  setSearchText("");
  history.replaceState(null, "");
});

describe("the tap that opens the box", () => {
  it("puts the caret in the field in the task of the tap itself", () => {
    // Safari puts a keyboard up only for a focus it is asked for inside the tap
    mountEmpty();
    hit().click();
    expect(document.activeElement).toBe(input());
  });
});

describe("the delete key on the field", () => {
  it("gives the text up and keeps the box open", async () => {
    mountWithQuery();
    await settled();
    expect(searchText()).toBe("猫");

    act(tr("search.clear")).click();
    await settled();

    expect(searchText()).toBe("");
    expect(band().dataset.open).toBe("true");
    expect(input().value).toBe("");
  });

  it("keeps the caret in the box, so the next query needs no second tap", async () => {
    mountWithQuery();
    await settled();

    act(tr("search.clear")).click();
    await settled();

    expect(document.activeElement).toBe(input());
  });

  it("answers with the way out once the text is gone", async () => {
    mountWithQuery();
    await settled();

    act(tr("search.clear")).click();
    await settled();
    act(tr("search.close")).click();
    await settled();

    expect(band().dataset.open).toBe("false");
  });
});

describe("Back", () => {
  it("stands on the history stack once the user opens the box", async () => {
    mountEmpty();
    await settled();
    expect(band().dataset.open).toBe("false");

    hit().click();
    await settled();

    expect(band().dataset.open).toBe("true");
    expect(standing()).toBe(true);
  });

  it("gives the box up when Back lands past its stand", async () => {
    mountEmpty();
    await settled();
    hit().click();
    await settled();

    // back off the stand, onto the entry the user was left on
    history.replaceState(null, "");
    window.dispatchEvent(new Event("popstate"));
    await settled();

    expect(band().dataset.open).toBe("false");
    expect(searchText()).toBe("");
  });

  it("leaves the box alone when the pop answers something stacked above it", async () => {
    mountEmpty();
    await settled();
    hit().click();
    await settled();

    window.dispatchEvent(new Event("popstate"));
    await settled();

    expect(band().dataset.open).toBe("true");
  });
});

describe("the press on the circle that opens the box", () => {
  // the growth is CSS keyed on this attribute, so the test asks what the finger decided
  const pressed = () => {
    hit().dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    return hit().dataset.press;
  };

  it("grows the circle for a finger that asked the box open", () => {
    mountEmpty();
    expect(pressed()).toBe("true");
  });

  it("leaves the circle alone for a finger that gives the box up", async () => {
    mountWithQuery();
    await settled();
    expect(pressed()).toBe("false");
  });

  it("stops growing the circle when the finger leaves it", () => {
    mountEmpty();
    pressed();
    hit().dispatchEvent(new MouseEvent("pointerleave", { bubbles: true }));
    expect(hit().dataset.press).toBe("false");
  });
});

describe("the charts beside the search circle", () => {
  const stats = () =>
    host.querySelector('[data-chrome="stats"]') as HTMLElement;
  const corner = () =>
    host.querySelector('[data-chrome="corner"]') as HTMLElement;

  it("stands at the band's left end, the corner at its right", () => {
    mountEmpty();
    expect(stats().className).toContain("col-start-1");
    expect(corner().className).toContain("col-start-2");
  });

  it("carries the way out to the charts", () => {
    mountEmpty();
    expect(
      stats().querySelector(`button[aria-label="${tr("chrome.stats")}"]`),
    ).toBeTruthy();
  });
});
