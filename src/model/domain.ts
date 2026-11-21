// src/model/domain.ts — pure domain derivations for an AdoptListing.
//
// Named after the domain (race/color/painter/price/date/lock), not a generic "utils".
// Only depends on the image-URL service (image.ts); it never touches the listings cache
// or network layer, so domain logic stays off infrastructure.
import type { AdoptListing } from "./types";
import { stableImageUrl } from "../data/image";
import { tr } from "../i18n";
import { listingPainterName } from "./translatedText";
import {
  colorLabel,
  mysteryRaceLabel,
  MYSTERY_RACE_NAME,
  raceLabel,
} from "../i18n/glossary";

// Static race-name dictionary (mirrors Swift raceNamesMap)
const RACE_NAMES: Record<number, string> = {
  1: "狼",
  2: "龙",
  3: "羊",
  4: "虎",
  5: "狗",
  6: "熊",
  7: "犬",
  8: "猫",
  10: "狐狸",
  12: "神兽",
  13: "兵器",
  14: "鱼",
  15: "昆虫",
  16: "豹",
  17: "植物",
  18: "蛇",
  19: "神话",
  20: "鸟",
  21: "兔",
  22: "龙犬",
  23: "蝙蝠",
  24: "狮",
  25: "东方龙",
  26: "神秘生物",
  27: "神",
  28: "鹿",
};

/** The species a listing belongs to, decided by its `raceId`. The name the API joins in answers only
 *  for an id we do not have: it still reads 神秘生物 for rows filed under 犬, 猫, 兔, 神兽 or 神. */
export function raceName(listing: AdoptListing): string | undefined {
  const fromId =
    listing.raceId == null ? undefined : RACE_NAMES[listing.raceId];
  return fromId ?? listing.harmonyRace?.raceName;
}

export function colorNames(listing: AdoptListing): string[] {
  return (
    listing.harmonyAdoptColorVos
      ?.map((c) => c.harmonyColor?.colorName)
      .filter((n): n is string => !!n) ?? []
  );
}

// The two functions above hand back the name the API wrote, in Chinese, and that name is a key:
// a saved filter holds it, the color dots and species icons are looked up by it, and the related
// rows are matched on it. A change of language happens on the way to the screen, through these.
export const raceDisplay = (listing: AdoptListing): string | undefined => {
  const name = raceName(listing);
  return name === undefined ? undefined : raceLabel(listing.raceId, name);
};

/** A listing that came with no species is counted as 神秘生物: the chart bars and the 物种 filter
 *  both hand it to that species, which is why a bar and a pick cover the same listings. Its own card
 *  shows no tag, so those two read `raceName` and `raceDisplay` instead. */
export const countedRaceName = (listing: AdoptListing): string =>
  raceName(listing) ?? MYSTERY_RACE_NAME;
export const countedRaceDisplay = (listing: AdoptListing): string =>
  raceDisplay(listing) ?? mysteryRaceLabel();

export const colorDisplay = colorLabel;

export function painterName(listing: AdoptListing): string | undefined {
  return listingPainterName(listing);
}

export function painterAvatar(listing: AdoptListing): string | undefined {
  const url = listing.harmonyPainterVo?.avatarPhoto;
  return url ? stableImageUrl(url) : undefined;
}

export function displayPrice(listing: AdoptListing): number {
  return listing.nonrecurringExpense ?? 0;
}

export function isAdopted(listing: AdoptListing): boolean {
  return listing.status === 1;
}

export function isLocked(listing: AdoptListing): boolean {
  return listing.isLock === 2;
}

// Static cached Date parsing (createTime "yyyy-MM-dd HH:mm:ss")
let cachedDateParse: ((s: string) => Date | null) | null = null;
function getDateParser(): (s: string) => Date | null {
  if (cachedDateParse) return cachedDateParse;
  // Manual parse avoids Date constructor locale ambiguity; also handles missing seconds
  cachedDateParse = (s) => {
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    const [, y, mo, d, h, mi, se] = m;
    const dt = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      se ? Number(se) : 0,
    );
    return dt.getTime() ? dt : null;
  };
  return cachedDateParse;
}

export function publishDate(listing: AdoptListing): Date | null {
  if (!listing.createTime) return null;
  return getDateParser()(listing.createTime);
}

/** The day that the listing went up, as "2025-03-21". An empty string when its createTime is
 *  missing or unreadable. */
export function publishDay(listing: AdoptListing): string {
  const d = publishDate(listing);
  if (!d) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** The day to show for the listing at `index`. When that row has no readable `createTime`, the day
 *  comes from the closest row before it that has one, or from the closest row after it when none
 *  is earlier. The order passed in is part of the answer: under another sort, the same row takes
 *  its day from another row. An index outside the list gives an empty string.
 *
 *  Each call scans outward from `index` until it finds a day, so calling it for every row is
 *  quadratic in the length of the list. */
export function publishDayAt(listings: AdoptListing[], index: number): string {
  const item = listings[index];
  if (!item) return "";
  const own = publishDay(item);
  if (own) return own;
  for (let i = index - 1; i >= 0; i--) {
    const day = publishDay(listings[i]);
    if (day) return day;
  }
  for (let i = index + 1; i < listings.length; i++) {
    const day = publishDay(listings[i]);
    if (day) return day;
  }
  return "";
}

export function detailImages(listing: AdoptListing): string[] {
  const fromDetails =
    listing.harmonyAdoptDetails
      ?.map((d) => d.detailPicture)
      .filter((s): s is string => !!s && s.length > 0)
      .map((s) => stableImageUrl(s)!) ?? [];
  if (fromDetails.length === 0 && listing.adoptPicture)
    return [stableImageUrl(listing.adoptPicture)!];
  return fromDetails;
}

export const MISSING_PRICE = "?";

/** Furmony leaves the price at 0 when a listing has none. Sorting also uses 0, which puts such
 *  a listing at the cheap end. */
// The shape of a sum of money belongs to the language on screen: ¥40500, 40500元, ¥40,500.
export function formatPrice(n: number): string {
  return n > 0 ? tr("money.amount", Math.round(n)) : MISSING_PRICE;
}

export function formatDiscount(listing: AdoptListing): number {
  const all = listing.allcost ?? 0;
  const non = listing.nonrecurringExpense ?? 0;
  if (all > 0 && non > 0 && all !== non) {
    const d = (non / all) * 10;
    if (d > 0 && d < 10) return d;
  }
  return 0;
}

// The shelf translates painter names when a request asks in another language, so the words
// 「自设委托」 only arrive that way in Chinese. The painter id behind them is 1 on every row of
// the shelf, and ids stay put across the whole saved copy.
export function isSelfCommission(listing: AdoptListing): boolean {
  return listing.harmonyPainterVo?.painterid === SELF_COMMISSION_PAINTER_ID;
}

export const SELF_COMMISSION_PAINTER_ID = 1;

// ---- price display modes ---------------------------------------------------
// The bottom-right FAB sets this; the cards and the detail sheet read it.
//   once        one payment: the price, the 12-period total struck through, a badge
//   installment 12 periods: the deposit, then the monthly amount
//   hidden      no number anywhere
//
// How Furmony takes payment:
//   allcost              total across 12 periods
//   nonrecurringExpense  the price for one payment, lower than allcost, so the page
//                        shows it as a discount
//   earnest              deposit paid first; the rest spreads over 12 months
export const PRICE_MODES = ["once", "installment", "hidden"] as const;
export type PriceMode = (typeof PRICE_MODES)[number];

/** The name of a price display mode, in the language on screen. */
const PRICE_MODE_KEY = {
  once: "price.once",
  installment: "price.installment",
  hidden: "price.hidden",
} as const;

export const priceModeLabel = (mode: PriceMode): string =>
  tr(PRICE_MODE_KEY[mode]);

export const INSTALLMENTS = 12;

/** The total across 12 periods. Without an allcost, it falls back to the pay-once
 *  price, so no discount exists. */
export function installmentTotal(listing: AdoptListing): number {
  const all = listing.allcost ?? 0;
  return all > 0 ? all : displayPrice(listing);
}

/**
 * The monthly amount: (installment total − deposit) / 12, rounded up, so the page
 * never shows a figure below the real one. null when the deposit already covers the
 * total; the caller then draws nothing.
 */
export function monthlyPayment(listing: AdoptListing): number | null {
  const rest = installmentTotal(listing) - (listing.earnest ?? 0);
  return rest > 0 ? Math.ceil(rest / INSTALLMENTS) : null;
}

// What we draw in a price slot. Components only lay this out.
//
// Two types, because the two modes share almost no fields: one payment has a price, a
// discount, and an original price; 12 periods have a deposit, a monthly amount, and a
// total. In one big type, a component read `down === null` as "not installment mode".

/** The one number on a waterfall card. A null label means no word before the number. */
export interface CardPrice {
  label: string | null;
  value: number;
}

/** One payment, settled at the discounted price. */
export interface OncePrice {
  mode: "once";
  /** the price; 0 means the listing has none */
  main: number;
  /** the 12-period total, struck through next to the price; only set when discount > 0 */
  secondary: number | null;
  /** the discount badge; 0 means no badge */
  discount: number;
  card: CardPrice;
}

/** 12 periods: a deposit plus a monthly amount. */
export interface InstallmentPrice {
  mode: "installment";
  /** the deposit. null means the listing has no deposit, which is not the same as 0. */
  down: number | null;
  /** the monthly amount; null when it cannot be worked out */
  main: number | null;
  /** "月供", the word before main; null with main */
  mainLabel: string | null;
  /** "×12期", the word after main; null with main */
  note: string | null;
  /** the total; null with main, because a total with no monthly amount is wrong */
  total: number | null;
  /** the deposit, or the monthly amount when there is no deposit; an unlabeled 0 when the
   *  listing has no price */
  card: CardPrice;
}

export type PriceParts = OncePrice | InstallmentPrice;

/** null when the mode hides prices. */
export function priceParts(
  listing: AdoptListing,
  mode: PriceMode,
): PriceParts | null {
  if (mode === "hidden") return null;
  if (mode === "installment") {
    const earnest = listing.earnest ?? 0;
    const down = earnest > 0 ? earnest : null;
    const per = monthlyPayment(listing);
    // A listing with no price has neither a deposit nor a monthly amount. The card shows a
    // price slot either way, so this one holds an unlabeled 0.
    const card: CardPrice =
      down !== null
        ? { label: tr("card.downPayment"), value: down }
        : per !== null
          ? { label: tr("card.monthly"), value: per }
          : { label: null, value: 0 };
    return {
      mode,
      down,
      main: per,
      mainLabel: per === null ? null : tr("info.monthly"),
      note: per === null ? null : tr("info.periods", INSTALLMENTS),
      total: per === null ? null : installmentTotal(listing),
      card,
    };
  }
  const once = displayPrice(listing);
  const discount = formatDiscount(listing);
  const all = listing.allcost ?? 0;

  return {
    mode: "once",
    main: once,
    // secondary means "the original price", so it shares the discount's condition. Two
    // listings cost more in one payment than in 12 periods (#578: 21000 / 19680, #2832:
    // 36300 / 33800). Under `allcost > 0` they drew a number below the price with no
    // strike-through and no badge.
    secondary: discount > 0 ? all : null,
    discount,
    card: { label: null, value: once },
  };
}
