// Functional tests for the price and publish-day rules in domain.ts. All numbers are FAKE.
import { describe, expect, it } from "vitest";
import { tr } from "../i18n";
import { setLocale } from "../i18n/locale";
import type { AdoptListing } from "./types";
import {
  formatPrice,
  isCommittedLock,
  isLocked,
  installmentTotal,
  monthlyPayment,
  priceParts,
  publishDay,
  publishDayAt,
  raceDisplay,
  raceName,
  shownStatus,
  type PriceMode,
} from "./domain";

// The fake listing: 30000 across 12 periods (allcost), a 6000 deposit (earnest), and
// 24000 to settle once (nonrecurringExpense), which is 8折 of the total.
function fake(over: Partial<AdoptListing> = {}): AdoptListing {
  return {
    adoptId: 1,
    paintersId: 2,
    productId: 3,
    nonrecurringExpense: 24000,
    allcost: 30000,
    earnest: 6000,
    ...over,
  };
}

const modes: PriceMode[] = ["once", "installment", "hidden"];

/** The two modes are two types, so each test claims the one it wants. A wrong claim is
 *  a bug, so throw instead of papering over it with `!`. */
function onceParts(l: AdoptListing) {
  const p = priceParts(l, "once");
  if (p?.mode !== "once")
    throw new Error(`想要一口价，拿到 ${JSON.stringify(p)}`);
  return p;
}
function planParts(l: AdoptListing) {
  const p = priceParts(l, "installment");
  if (p?.mode !== "installment")
    throw new Error(`想要分期，拿到 ${JSON.stringify(p)}`);
  return p;
}

describe("the 状态 row's one word", () => {
  const one = (over: Partial<AdoptListing>) =>
    ({ adoptId: 1, ...over }) as AdoptListing;

  it("takes the shelf's words in the order a buyer reads them", () => {
    expect(shownStatus(one({}), false)).toBe("open");
    expect(shownStatus(one({ isLock: 1 }), false)).toBe("locking");
    expect(shownStatus(one({ isLock: 2 }), false)).toBe("locked");
    expect(shownStatus(one({ status: 1 }), false)).toBe("adopted");
  });

  it("reads a paid lock ahead of an adoption the shelf has not recorded", () => {
    expect(shownStatus(one({ status: 0, isLock: 2 }), false)).toBe("locked");
  });

  it("reads a debut album as the piece having gone out the door", () => {
    expect(shownStatus(one({}), true)).toBe("adopted");
    expect(shownStatus(one({ isLock: 1 }), true)).toBe("adopted");
    expect(shownStatus(one({ isLock: 2 }), true)).toBe("adopted");
  });

  it("reads a missing flag as open", () => {
    expect(shownStatus(one({ isLock: undefined }), false)).toBe("open");
  });
});

describe("formatPrice", () => {
  it("draws a rounded number with ¥", () => {
    expect(formatPrice(6800)).toBe("¥6800");
    expect(formatPrice(6800.4)).toBe("¥6800");
  });

  it("says the number is missing when there is no price", () => {
    // Furmony leaves the price at 0 when a listing has none, and ¥0 reads as free.
    expect(formatPrice(0)).toBe("?");
    expect(formatPrice(-5)).toBe("?");
  });
});

describe("installmentTotal", () => {
  it("is the 12-period total, i.e. allcost", () => {
    expect(installmentTotal(fake())).toBe(30000);
  });

  it("falls back to the 一口价 when allcost was never filled in", () => {
    expect(installmentTotal(fake({ allcost: undefined }))).toBe(24000);
    expect(installmentTotal(fake({ allcost: 0 }))).toBe(24000);
  });
});

describe("monthlyPayment", () => {
  it("splits what is LEFT after the deposit", () => {
    // (30000 − 6000) / 12
    expect(monthlyPayment(fake())).toBe(2000);
  });

  it("matches the real case it was built for", () => {
    // 28500 to settle once, 30600 across 12 periods, a 6120 deposit: a 6120 down
    // payment and 2040 a month.
    const l = fake({
      nonrecurringExpense: 28500,
      allcost: 30600,
      earnest: 6120,
    });
    const p = planParts(l);
    expect(p.down).toBe(6120);
    expect(p.main).toBe(2040);
    expect(p.total).toBe(30600);
  });

  it("rounds UP, so a card never promises less than the real installment", () => {
    expect(monthlyPayment(fake({ allcost: 1000, earnest: 0 }))).toBe(84);
  });

  it("works without a deposit", () => {
    expect(monthlyPayment(fake({ earnest: 0 }))).toBe(2500);
  });

  it("has no opinion when the deposit already covers everything", () => {
    expect(monthlyPayment(fake({ earnest: 30000 }))).toBeNull();
    expect(
      monthlyPayment(fake({ nonrecurringExpense: 0, allcost: 0, earnest: 0 })),
    ).toBeNull();
  });
});

describe("priceParts — once", () => {
  it("keeps the historical display: price + strikethrough + discount", () => {
    const p = onceParts(fake());
    expect(p.mode).toBe("once");
    expect(p.main).toBe(24000);
    expect(p.secondary).toBe(30000);
    expect(p.discount).toBeCloseTo(8);
    expect(p.card).toEqual({ label: null, value: 24000 });
  });

  it("drops the second number when allcost was never filled in", () => {
    // With no 12-period total there is no discount either, so nothing gets struck through.
    const p = onceParts(fake({ allcost: undefined }));
    expect(p.discount).toBe(0);
    expect(p.secondary).toBeNull();
  });

  it("drops the second number when there is nothing to discount", () => {
    // The pay-once price equals the 12-period total, so a second number would repeat
    // the first one.
    const same = onceParts(fake({ nonrecurringExpense: 30000 }));
    expect(same.discount).toBe(0);
    expect(same.secondary).toBeNull();

    // The pay-once price sits above the 12-period total (#578: 21000 / 19680). The old
    // condition drew a number below the price with no strike-through and no badge.
    const worse = onceParts(
      fake({ nonrecurringExpense: 21000, allcost: 19680 }),
    );
    expect(worse.main).toBe(21000);
    expect(worse.secondary).toBeNull();
    expect(worse.discount).toBe(0);
  });

  it("draws ¥0 rather than nothing, exactly as before", () => {
    expect(onceParts(fake({ nonrecurringExpense: undefined })).main).toBe(0);
  });
});

describe("priceParts — installment", () => {
  it("leads with the deposit, then the monthly detail", () => {
    const p = planParts(fake());
    expect(p.mode).toBe("installment");
    expect(p.down).toBe(6000); // the first row, the one it highlights
    expect(p.main).toBe(2000); // the second row: monthly
    expect(p.mainLabel).toBe("月供");
    expect(p.note).toBe("×12期");
    expect(p.total).toBe(30000); // the second row: total
    expect(p.card).toEqual({ label: "首付", value: 6000 });
  });

  it("puts the deposit on the card and nothing else", () => {
    expect(planParts(fake()).card).toEqual({ label: "首付", value: 6000 });
  });

  it("prefixes the card with the short word where the two words differ", () => {
    setLocale("en");
    try {
      expect(planParts(fake()).card).toEqual({ label: "Down", value: 6000 });
      expect(planParts(fake({ earnest: 0 })).card).toEqual({
        label: "Monthly",
        value: 2500,
      });
      // The detail page has the room for the full words.
      expect(tr("info.downPayment")).toBe("Deposit");
      expect(tr("money.amount", 6000)).toBe("¥6,000");
    } finally {
      setLocale("zh");
    }
  });

  it("falls back to the monthly amount on the card when there is no deposit", () => {
    const p = planParts(fake({ earnest: 0 }));
    // null means "this listing has no deposit", which is not 0. The detail sheet picks
    // its rows on this. Falling back to 0 told the user nobody had to pay a deposit:
    // #848 and the five others drew 首付¥0 and 定金¥0 in the same sheet.
    expect(p.down).toBeNull();
    expect(p.card).toEqual({ label: "月供", value: 2500 });
  });

  it("gives the card a missing price when the listing has none", () => {
    const p = planParts(
      fake({ nonrecurringExpense: 0, allcost: 0, earnest: 0 }),
    );
    expect(p.main).toBeNull();
    expect(p.down).toBeNull();
    expect(p.total).toBeNull();
    // The card draws `?` from an unlabeled 0.
    expect(p.card).toEqual({ label: null, value: 0 });
    expect(p.mainLabel).toBeNull();
    expect(p.note).toBeNull();
  });

  it("still reports the total when allcost was never filled in", () => {
    // With no allcost, the total falls back to the pay-once price, and the monthly
    // amount spreads over that number.
    const p = planParts(fake({ allcost: undefined }));
    expect(p.total).toBe(24000);
    expect(p.main).toBe(1500);
  });
});

describe("priceParts — hidden", () => {
  it("returns nothing at all", () => {
    // null, not an object with every field empty: <Show when={parts()}> then draws
    // nothing at all.
    expect(priceParts(fake(), "hidden")).toBeNull();
  });
});

describe("priceParts — every mode", () => {
  it("never leaks a negative or NaN amount", () => {
    for (const mode of modes) {
      for (const over of [
        {},
        { nonrecurringExpense: 0 },
        { allcost: -5 },
        { earnest: 999999 },
        { nonrecurringExpense: 7, allcost: undefined, earnest: undefined },
      ]) {
        const p = priceParts(fake(over), mode);
        if (!p) continue;
        const nums = [
          p.main,
          p.card?.value ?? null,
          ...(p.mode === "installment" ? [p.down, p.total] : [p.secondary]),
        ];
        for (const n of nums) {
          if (n !== null) expect(Number.isFinite(n) && n >= 0).toBe(true);
        }
      }
    }
  });
});

describe("publishDay", () => {
  it("keeps the day and drops the clock", () => {
    expect(publishDay(fake({ createTime: "2025-03-21 08:07:06" }))).toBe(
      "2025-03-21",
    );
  });

  it("is empty when the time is missing or unreadable", () => {
    expect(publishDay(fake())).toBe("");
    expect(publishDay(fake({ createTime: "春天发布的" }))).toBe("");
  });
});

describe("publishDayAt", () => {
  const at = (id: number, createTime?: string) =>
    fake({ adoptId: id, createTime });
  // 846, 848 and 850 are real listings, and 848 is one whose createTime is missing.
  const rows = () => [
    at(846, "2025-03-21 10:00:00"),
    at(848),
    at(850, "2025-03-28 10:00:00"),
  ];

  it("keeps the day of the row that has one", () => {
    expect(publishDayAt(rows(), 0)).toBe("2025-03-21");
    expect(publishDayAt(rows(), 2)).toBe("2025-03-28");
  });

  it("takes the day of the row before, not the one after", () => {
    expect(publishDayAt(rows(), 1)).toBe("2025-03-21");
  });

  it("takes the day of the row after when nothing before has one", () => {
    expect(publishDayAt([at(1), at(2), at(3, "2025-05-24 10:00:00")], 1)).toBe(
      "2025-05-24",
    );
  });

  it("walks past the rows with no day of their own", () => {
    const wide = [at(846, "2025-03-21 10:00:00"), at(848), at(849), at(850)];
    expect(publishDayAt(wide, 3)).toBe("2025-03-21");
  });

  it("is empty when no row has a day", () => {
    expect(publishDayAt([at(1), at(2)], 0)).toBe("");
  });

  it("is empty for a row that is not in the list", () => {
    // The grid reads the top row of the window, and an empty list has no such row.
    expect(publishDayAt(rows(), -1)).toBe("");
    expect(publishDayAt(rows(), 3)).toBe("");
    expect(publishDayAt([], 0)).toBe("");
  });
});

describe("the species a listing belongs to", () => {
  const row = (over: Partial<AdoptListing>) =>
    ({ adoptId: 1, paintersId: 2, productId: 3, ...over }) as AdoptListing;

  it("comes from the id, with the joined name as the fallback", () => {
    // The API still joins 神秘生物 onto rows whose id points elsewhere.
    const stale = row({ raceId: 7, harmonyRace: { raceName: "神秘生物" } });
    expect(raceName(stale)).toBe("犬");
    expect(raceDisplay(stale)).toBe("犬");
  });

  it("keeps the joined name when the id is one we do not have", () => {
    const unknown = row({ raceId: 0, harmonyRace: { raceName: "凤凰" } });
    expect(raceName(unknown)).toBe("凤凰");
    expect(raceDisplay(unknown)).toBe("凤凰");
  });

  it("names nothing for a row that came with neither", () => {
    expect(raceName(row({}))).toBeUndefined();
    expect(raceDisplay(row({}))).toBeUndefined();
  });
});

describe("the lock flags", () => {
  it("treats a hold and a paid lock as locked", () => {
    expect(isLocked(fake({ isLock: 1 }))).toBe(true);
    expect(isLocked(fake({ isLock: 2 }))).toBe(true);
  });

  it("treats a missing flag as unlocked", () => {
    expect(isLocked(fake({ isLock: 0 }))).toBe(false);
    expect(isLocked(fake())).toBe(false);
  });

  it("matches only the paid lock", () => {
    expect(isCommittedLock(fake({ isLock: 1 }))).toBe(false);
    expect(isCommittedLock(fake({ isLock: 2 }))).toBe(true);
    expect(isCommittedLock(fake())).toBe(false);
  });
});
