// The 详细描述 row keeps a paragraph's worth of space while an answer is on its way, and the text
// is translated when it is not in the language on screen. Both are about the same row: the reader
// should not watch it resize, and should not have to read a language they did not pick.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import type { AdoptListing } from "../../model/types";
import { setLocale } from "../../i18n";
import { rememberWords } from "../../model/translatedText";
import { FLOW_OVER_MS } from "./FlowText";
import { InfoTable } from "./InfoTable";

// The 状态 row can read further along than the shelf does: an album of the debut day is the studio's
// own photo of a piece that exists. The table reads that table from `debutsStore`.
const albums = vi.hoisted(() => ({ current: new Map<number, string[]>() }));
vi.mock("../../stores/debutsStore", () => ({ debuts: () => albums.current }));

// A socials entry only means the studio posted the piece somewhere: a piece still waiting to be
// made also has one. The 状态 row has to stay unmoved by it.
const socials = vi.hoisted(() => ({ current: new Map<number, unknown>() }));
vi.mock("../../stores/socialsStore", () => ({
  socials: () => socials.current,
  socialSearch: () => [],
}));

// Made-up words about nothing. The translation cache is keyed by text, so each listing carries its
// own id and one test cannot read another test's answer.
const words = (id: number) =>
  `这一段介绍是编出来的，只用来测试翻译。${id}`.repeat(3);
const wordsTraditional = "這一段介紹是編出來的，只用來測試翻譯。";

const row = (adoptId: number): AdoptListing =>
  ({
    adoptId,
    adoptName: "测试设定",
    detailDescription: words(adoptId),
    paintersId: 3,
    productId: 1,
    raceId: 2,
    allcost: 12345,
    harmonyPainterVo: { painterid: 7, painterName: "测试画师" },
    harmonyAdoptDetails: [],
  }) as AdoptListing;

/** Stand in for the translation endpoint. Returns the sections it was sent, one per call. */
function endpoint(lines: string[] | null) {
  const sent: string[][] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body))[0][0]);
      return lines === null
        ? { ok: false, status: 503 }
        : { ok: true, json: async () => [lines] };
    }),
  );
  return sent;
}

/**
 * Stand in for the endpoint with the answer held back, so a test can act while a request is on its
 * way. `sent` holds one signal per call, and `release` answers every call that is waiting. A call
 * that was called off fails the way `fetch` fails, so it stores nothing.
 */
function waiting() {
  const sent: AbortSignal[] = [];
  let release: (lines: string[]) => void = () => {};
  const answer = new Promise<string[]>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const signal = init.signal as AbortSignal;
      sent.push(signal);
      const lines = await answer;
      if (signal.aborted) throw new DOMException("called off", "AbortError");
      return { ok: true, json: async () => [lines] };
    }),
  );
  return { sent, release };
}

/** Let the request promise settle and Solid repaint. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

let dispose: (() => void) | undefined;
// Solid hands clicks to a listener on the document, so a host that never reached the page never
// sees one.
let hosts: HTMLElement[] = [];
afterEach(() => {
  dispose?.();
  dispose = undefined;
  hosts.forEach((host) => host.remove());
  hosts = [];
  albums.current = new Map();
  setLocale("zh");
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Draw the table for a listing whose translated words are already in hand, one table at a time. A
 *  render the test has moved on from would otherwise answer to the next language. Pass an accessor
 *  to hand the row a new listing later. */
function draw(
  source: AdoptListing | (() => AdoptListing),
  lang: "en" | "ja" | "zh" | "zh_tw",
) {
  const l = () => (typeof source === "function" ? source() : source);
  dispose?.();
  rememberWords([l()], lang);
  setLocale(lang);
  const host = document.createElement("div");
  document.body.appendChild(host);
  hosts.push(host);
  dispose = render(() => <InfoTable listing={l()} />, host);
  const label = [...host.querySelectorAll("dt")].find(
    (s) => s.textContent === "Description",
  );
  return { host, body: () => label!.parentElement! };
}

describe("the 状态 row", () => {
  const one = (adoptId: number) =>
    ({ ...row(adoptId), status: 0, isLock: 1 }) as AdoptListing;

  it("reads an album as one word: Adopted", () => {
    albums.current = new Map([[41, ["https://cdn.example/debut.jpg"]]]);
    const { host } = draw(one(41), "en");
    expect(host.textContent).toContain("Adopted");
    expect(
      host.textContent,
      "a hold with an album is no longer in progress",
    ).not.toContain("Lock in progress");
    expect(host.textContent).not.toContain("Open");
  });

  // The row's own box: the table holds other badges, and one of them is not this row's business.
  const statusRow = (host: HTMLElement) => {
    const dt = [...host.querySelectorAll("dt")].find(
      (d) => d.textContent === "Status",
    );
    expect(dt, "the row is drawn").toBeTruthy();
    return [...dt!.parentElement!.querySelectorAll("span")].map((b) =>
      b.textContent?.trim(),
    );
  };

  it("shows one word, not a pair of badges", () => {
    const { host } = draw(one(43), "en");
    expect(statusRow(host)).toEqual(["Lock in progress"]);
  });

  it("shows one word for an album too", () => {
    albums.current = new Map([[47, ["https://cdn.example/debut.jpg"]]]);
    const { host } = draw(one(47), "en");
    expect(statusRow(host)).toEqual(["Adopted"]);
  });

  it("stays put on a socials entry, which a piece waiting to be made also has", () => {
    socials.current = new Map([[49, { ownerName: "测试主人", platforms: {} }]]);
    const { host } = draw(one(49), "en");
    expect(host.textContent, "the entry is the one being read").toContain(
      "测试主人",
    );
    expect(statusRow(host)).toEqual(["Lock in progress"]);
  });

  it("shows the lock the shelf recorded", () => {
    const held = { ...one(44), isLock: 1 } as AdoptListing;
    const paid = { ...one(45), isLock: 2 } as AdoptListing;
    const free = { ...one(46), isLock: 0 } as AdoptListing;
    expect(draw(held, "en").host.textContent).toContain("Lock in progress");
    expect(draw(paid, "en").host.textContent).toContain("Locked");
    expect(draw(free, "en").host.textContent).toContain("Open");
  });
});

describe("the description row", () => {
  it("holds three lines of their own length while the translation is on its way", () => {
    const { body } = draw(row(1), "en");

    const bars = [...body().querySelectorAll('span[aria-hidden="true"]')];
    expect(bars).toHaveLength(3);
    const widths = bars.map(
      (b) => /(?:^|\s)(w-\S+)/.exec(b.className)?.[1] ?? "",
    );
    expect(new Set(widths).size, `three lengths, got ${widths.join(" ")}`).toBe(
      3,
    );
  });

  it("writes what the listing came with when it already fits the screen", () => {
    const english = {
      ...row(2),
      detailDescription: "Some made-up English words about nothing.",
    };
    const { body } = draw(english, "en");
    expect(body().textContent).toContain("Some made-up English words");
    expect(
      body().querySelector("button"),
      "nothing to translate, so no button",
    ).toBeNull();
  });

  it("asks for the translation on its own and keeps the placeholder while it waits", async () => {
    const sent = endpoint(["Some made-up words."]);
    const { body } = draw(row(3), "en");
    expect(sent, "the row translates itself without being asked").toHaveLength(
      1,
    );
    expect(
      body().querySelectorAll('span[aria-hidden="true"]'),
      "placeholder while it waits",
    ).toHaveLength(3);
    await settle();
  });

  it("is lit while the request is on its way, and a tap calls it off", async () => {
    const { sent, release } = waiting();
    const { body } = draw(row(4), "en");
    const button = body().querySelector("button")!;

    expect(button.className, "the offer is on from the start").toContain(
      "bg-accent/15",
    );
    expect(
      button.getAttribute("title"),
      "a tap shows the original words",
    ).toContain("original");

    button.click();
    expect(
      body().querySelectorAll('span[aria-hidden="true"]'),
      "the placeholder is gone",
    ).toHaveLength(0);
    expect(body().textContent).toContain(words(4));

    release(["Some made-up words."]);
    await settle();
    expect(
      body().textContent,
      "an answer the reader called off stays off the row",
    ).not.toContain("Some made-up");

    button.click();
    await settle();
    expect(sent, "a later tap asks again").toHaveLength(2);
    expect(body().textContent, "the new answer is shown").toContain(
      "Some made-up words.",
    );
  });

  it("shows the answer, marks it, and hands the row back on a tap", async () => {
    const sent = endpoint(["Some made-up words, kept short."]);
    const { body } = draw(row(5), "en");
    await settle();

    expect(body().textContent).toContain("Some made-up words, kept short.");
    expect(body().textContent, "machine words are labelled as such").toContain(
      "Machine translation",
    );
    const button = body().querySelector("button")!;
    expect(
      button.className,
      "the button is lit while the translation is on screen",
    ).toContain("bg-accent/15");

    button.click();
    expect(body().textContent).toContain(words(5));
    expect(body().textContent).not.toContain("Machine translation");

    button.click();
    await settle();
    expect(body().textContent).toContain("Some made-up words, kept short.");
    expect(sent, "the answer is kept, so no second request").toHaveLength(1);
  });

  it("keeps the original words and leaves the button off when the request fails", async () => {
    const sent = endpoint(null);
    const { body } = draw(row(6), "en");
    await settle();

    expect(body().textContent).toContain(words(6));
    expect(body().querySelectorAll('span[aria-hidden="true"]')).toHaveLength(0);
    const button = body().querySelector("button")!;
    expect(button.className, "a failure is not marked").not.toContain("red");
    expect(button.className).toContain("bg-surface-2");
    const title = button.getAttribute("title")!;
    expect(title, "a failure says nothing about itself").not.toMatch(
      /fail|again/i,
    );
    expect(title, "the ordinary offer, which is what a tap does").toContain(
      "translate",
    );

    button.click();
    expect(
      sent,
      "the tap that asked for it sends the request again",
    ).toHaveLength(2);
  });

  it("leaves 简体中文 alone, and asks 繁體中文 about simplified words", () => {
    endpoint(["答案"]);
    const traditional = { ...row(7), detailDescription: wordsTraditional };
    const simplified = row(8);

    const zhButtons = draw(simplified, "zh").host.querySelectorAll(
      "button",
    ).length;
    const twButtons = draw(traditional, "zh_tw").host.querySelectorAll(
      "button",
    ).length;
    const twSimplified = draw(simplified, "zh_tw");

    expect(zhButtons, "a 简体中文 screen has nothing to translate").toBe(0);
    expect(twButtons, "traditional words need no translation").toBe(0);
    expect(
      [...twSimplified.host.querySelectorAll("button")],
      "simplified words do",
    ).toHaveLength(1);
  });
});

describe("the way the answer comes in", () => {
  const units = (host: ParentNode) => host.querySelectorAll(".flow-unit");

  it("arrives out of a blur, and stops once it has all landed", async () => {
    vi.useFakeTimers();
    endpoint(["Some made-up words, kept short."]);
    const { host, body } = draw(row(20), "en");
    await vi.advanceTimersByTimeAsync(0);

    expect(body().textContent).toContain("Some made-up words, kept short.");
    expect(units(host).length, "the arrival is shown as one").toBeGreaterThan(
      1,
    );

    await vi.advanceTimersByTimeAsync(FLOW_OVER_MS + 10);
    expect(units(host), "spent: the words are just words now").toHaveLength(0);
    expect(body().textContent).toContain("Some made-up words, kept short.");
  });

  it("opens a second time with the answer already in hand, and says nothing about it", async () => {
    vi.useFakeTimers();
    const sent = endpoint(["Some made-up words, kept short."]);
    draw(row(23), "en");
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(FLOW_OVER_MS + 10);

    const { host, body } = draw(row(23), "en");
    await vi.advanceTimersByTimeAsync(0);
    expect(body().textContent).toContain("Some made-up words, kept short.");
    expect(
      units(host),
      "nothing arrived, so nothing announces itself",
    ).toHaveLength(0);
    expect(sent, "the answer came out of the table").toHaveLength(1);
  });

  it("says nothing when the store hands the same words over again", async () => {
    vi.useFakeTimers();
    endpoint(["Some made-up words, kept short."]);
    /* eslint-disable solid/reactivity -- a test body reads and writes the signal itself;
       draw() renders it inside its own JSX */
    const [listing, setListing] = createSignal(row(21));
    const { host, body } = draw(listing, "en");
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(FLOW_OVER_MS + 10);

    setListing({ ...listing(), adoptName: "列表刷新了" });
    await vi.advanceTimersByTimeAsync(0);
    expect(body().textContent).toContain("Some made-up words, kept short.");
    expect(units(host), "the same answer is no arrival").toHaveLength(0);
    /* eslint-enable solid/reactivity */
  });

  it("brings back an answer already in hand the way it came", async () => {
    vi.useFakeTimers();
    const sent = endpoint(["Some made-up words, kept short."]);
    const { host, body } = draw(row(22), "en");
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(FLOW_OVER_MS + 10);
    const button = body().querySelector("button")!;

    button.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(units(host), "the original words came plainly").toHaveLength(0);

    button.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(body().textContent).toContain("Some made-up words, kept short.");
    expect(units(host).length, "this tap is when it arrived").toBeGreaterThan(
      1,
    );
    expect(sent, "and nothing was asked for twice").toHaveLength(1);
  });
});
