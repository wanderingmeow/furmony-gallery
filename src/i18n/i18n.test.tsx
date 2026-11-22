// The language layer, checked the way a reader would notice it failing: a word missing in one
// language, a first visit landing in the wrong one, a species the shelf knows and the app does
// not, or a screen that keeps its old words after the switch.
import { afterEach, describe, expect, it } from "vitest";
import { render } from "solid-js/web"; // the component test below needs a document to draw into
import { flatten } from "@solid-primitives/i18n";
import { DICTIONARIES } from "./dict";
import {
  API_LANGUAGE,
  asLocale,
  DETECT_LOCALE_SCRIPT,
  LOCALE_KEY,
  LOCALES,
  localeFromTag,
  resolveApiLanguage,
  type Locale,
} from "./apiLanguage";
import {
  apiLanguage,
  locale,
  requestedLocale,
  setLocale,
  storedLocale,
} from "./locale";

/** The language a test moves the app to. A pick moves the requests and the screen in one step. */
const pick = (next: Locale): void => {
  setLocale(next);
};
import { tr } from "./index";
import {
  COLORS,
  COLOR_ORDER,
  inOrder,
  RACES,
  RACE_ORDER,
  raceLabel,
  raceLabelByName,
} from "./glossary";
import { raceName } from "../model/domain";
import { LockedIcon } from "../components/ui/LockedIcon";
import type { AdoptListing } from "../model/types";

/** A language has the same words as 简体中文, in the same places. */
const keysOf = (locale: Locale): string[] =>
  Object.keys(flatten(DICTIONARIES[locale])).sort();

const SAMPLES: Record<string, unknown[]> = {
  "sort.title": ["Newest first"],
  "filter.socialNote": [41],
  "info.periods": [12],
  "info.total": ["¥1,200"],
  "info.discount": [8.5],
  "stats.count": [7],
  "stats.times": [7],
  "stats.totalTimes": [7],
  "stats.totalListings": [7],
  "stats.months": [7],
  "stats.avgMedian": [1200, 900],
  "stats.band": ["0k", "2k", 5],
  "stats.monthLabel": [2024, 3],
  "money.amount": [40500],
  "empty.queryTitle": ["红色的龙"],
  "notify.expand": [3],
};

afterEach(() => {
  localStorage.removeItem(LOCALE_KEY);
  pick("zh");
});

describe("a pick moves the screen on the tap", () => {
  // Every word the app owns is in the dictionary, so nothing on screen waits for the shelf. The
  // three fields the shelf translates are the exception, and model/translatedText reports those.
  it("moves the requests and the screen together", () => {
    pick("zh");
    setLocale("ja");
    expect(requestedLocale()).toBe("ja");
    expect(apiLanguage()).toBe("pa");
    expect(locale()).toBe("ja");
    expect(tr("filter.language")).toBe("表示言語");
  });

  it("tells the document, which is what a screen reader and the browser ask about", () => {
    setLocale("en");
    expect(document.documentElement.lang).toBe("en");
    pick("zh");
    expect(document.documentElement.lang).toBe("zh-Hans");
  });

  it("keeps the choice for the next visit", () => {
    pick("ja");
    expect(storedLocale()).toBe("ja");
    pick("zh");
  });
});

describe("the four dictionaries", () => {
  it("answer the same keys as 简体中文", () => {
    const source = keysOf("zh");
    expect(source.length).toBeGreaterThan(100);
    for (const locale of LOCALES) expect(keysOf(locale)).toEqual(source);
  });

  // English ends the sentence about the licence with the link, so nothing follows it. Every
  // other key in every language has to say something.
  const MAY_BE_EMPTY = ["band.codeAfter"];

  it("say something for every key", () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(
        flatten(DICTIONARIES[locale]),
      )) {
        // `flatten` keeps a branch under its own name as well as under its dotted keys.
        if (value !== null && typeof value === "object") continue;
        if (typeof value === "function") {
          const said = (value as (...args: unknown[]) => string)(
            ...(SAMPLES[key] ?? []),
          );
          expect(said, `${locale}.${key}`).not.toBe("");
          continue;
        }
        expect(typeof value, `${locale}.${key}`).toBe("string");
        if (MAY_BE_EMPTY.includes(key)) continue;
        expect((value as string).length, `${locale}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  // English needs the singular at one, so no formatter here may render "1 listings".
  it("takes the singular at one", () => {
    const pluralAfterOne = /\b1 [a-z]+s\b/;
    for (const [key, value] of Object.entries(flatten(DICTIONARIES.en))) {
      if (typeof value !== "function") continue;
      const args = SAMPLES[key];
      if (!args) continue;
      args.forEach((arg, i) => {
        if (typeof arg !== "number") return;
        const one = [...args];
        one[i] = 1;
        const said = (value as (...a: unknown[]) => string)(...one);
        expect(said, key).not.toMatch(pluralAfterOne);
      });
    }
  });

  it("names a month in its own way", () => {
    pick("zh");
    expect(tr("stats.monthLabel", 2024, 3)).toBe("24年3月");
    pick("en");
    expect(tr("stats.monthLabel", 2024, 3)).toBe("Mar 2024");
  });

  it("writes a sum of money the way its own readers write one", () => {
    pick("zh");
    expect(tr("money.amount", 40500)).toBe("¥40500");
    pick("zh_tw");
    expect(tr("money.amount", 40500)).toBe("40500元");
    pick("ja");
    expect(tr("money.amount", 40500)).toBe("40500元");
    pick("en");
    expect(tr("money.amount", 40500)).toBe("¥40,500");
    expect(tr("money.amount", 999)).toBe("¥999");
  });

  it("writes a discount the way its own readers count it", () => {
    // 8.5 折 is 85 % of the price left to pay, which English and Japanese count as 15 % off.
    pick("zh");
    expect(tr("info.discount", 8.5)).toBe("8.5折");
    pick("ja");
    expect(tr("info.discount", 8.5)).toBe("15%引き");
    pick("en");
    expect(tr("info.discount", 8.5)).toBe("15% off");
  });
});

describe("the language of a first visit", () => {
  const TAGS = [
    "zh-CN",
    "zh",
    "zh-Hans",
    "zh-TW",
    "zh-HK",
    "zh-Hant-TW",
    "en-US",
    "en-GB",
    "ja-JP",
    "ja",
    "ko-KR",
    "fr",
    "",
    "ZH_tw",
  ];

  it("comes out the same from the app and from the document script", () => {
    const detect = new Function(`return ${DETECT_LOCALE_SCRIPT}`)() as (
      tag: string,
    ) => Locale;
    for (const tag of TAGS) {
      // The document script answers a language even where the app would say null; the two rules
      // are the interesting part, and both fall back to the shelf's own language.
      expect(detect(tag)).toBe(localeFromTag(tag) ?? "zh");
    }
  });

  it("asks the API in the code that code is written for", () => {
    expect(resolveApiLanguage("ja", "zh-CN")).toBe("pa");
    expect(resolveApiLanguage("en", "zh-CN")).toBe("us");
    expect(resolveApiLanguage("zh_tw", "en-US")).toBe("zh_tw");
    expect(resolveApiLanguage(null, "en-GB")).toBe("us");
    expect(resolveApiLanguage(null, "ja-JP")).toBe("pa");
    expect(resolveApiLanguage(null, "zh-HK")).toBe("zh_tw");
    // A choice that is not one of ours, and a browser that speaks none of them.
    expect(resolveApiLanguage("klingon", "ko-KR")).toBe("zh");
  });

  it("keeps the four codes apart", () => {
    for (const locale of LOCALES) expect(API_LANGUAGE[locale]).toBeTruthy();
    expect(new Set(LOCALES.map((l) => API_LANGUAGE[l])).size).toBe(
      LOCALES.length,
    );
  });

  it("reads back a choice the reader made", () => {
    // The suite opens in 简体中文, and that choice is written down like any other.
    expect(storedLocale()).toBe("zh");
    pick("ja");
    expect(storedLocale()).toBe("ja");
    expect(document.documentElement.lang).toBe("ja");
    expect(asLocale("zh_tw")).toBe("zh_tw");
    expect(asLocale("us")).toBeNull();
  });
});

describe("the words the API keeps in Chinese", () => {
  const listing = (raceId: number): AdoptListing =>
    ({ adoptId: 1, raceId }) as AdoptListing;

  it("has a word in every language for every species", () => {
    for (const [id, term] of Object.entries(RACES)) {
      for (const locale of LOCALES)
        expect(term[locale].length, `race ${id} ${locale}`).toBeGreaterThan(0);
    }
  });

  it("agrees with the species table the data is read through", () => {
    // The two tables would drift silently: domain.ts answers a raceId, and this one turns the
    // answer into another language. They are keyed the same way on purpose.
    for (const [id, term] of Object.entries(RACES)) {
      expect(raceName(listing(Number(id))), `race ${id}`).toBe(term.zh);
    }
  });

  it("finds a species by the name a saved filter holds", () => {
    pick("en");
    expect(raceLabelByName("龙")).toBe("Dragon");
    expect(raceLabel(2, "龙")).toBe("Dragon");
    // 狗 and 犬 are two ids on the shelf, and English has to keep them apart too.
    expect(raceLabelByName("狗")).not.toBe(raceLabelByName("犬"));
    // A species the shelf invents later keeps the name the API wrote.
    expect(raceLabelByName("水母")).toBe("水母");
  });

  it("lists every species and every color once in the order the panel shows them", () => {
    // The panel sorts by these two lists, so a name missing from one lands at the end of its block,
    // where nobody looks for it.
    expect(RACE_ORDER).toHaveLength(Object.keys(RACES).length);
    for (const term of Object.values(RACES))
      expect(RACE_ORDER, term.zh).toContain(term.zh);
    expect(COLOR_ORDER).toHaveLength(Object.keys(COLORS).length);
    for (const name of Object.keys(COLORS)) expect(COLOR_ORDER).toContain(name);
  });

  it("keeps a name no order has at the end of the block", () => {
    expect(["水母", "犬", "狼"].sort(inOrder(RACE_ORDER))).toEqual([
      "狼",
      "犬",
      "水母",
    ]);
  });

  it("has a word in every language for every color", () => {
    for (const [name, term] of Object.entries(COLORS)) {
      for (const locale of LOCALES)
        expect(term[locale].length, `${name} ${locale}`).toBeGreaterThan(0);
    }
  });
});

describe("a screen already open", () => {
  it("changes its words when the reader changes language", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const dispose = render(() => <LockedIcon size="12px" />, host);
    const icon = () => host.querySelector('[role="img"]') as HTMLElement;
    try {
      expect(icon().getAttribute("aria-label")).toBe("已锁定");
      pick("en");
      expect(icon().getAttribute("aria-label")).toBe("Locked");
      expect(icon().title).toBe("Locked");
      pick("ja");
      expect(icon().getAttribute("aria-label")).toBe("確定");
    } finally {
      dispose();
      host.remove();
    }
  });
});
