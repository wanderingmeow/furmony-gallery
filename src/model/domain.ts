// src/model/domain.ts — pure domain derivations for an AdoptListing.
//
// Named after the domain (race/color/painter/price/date/lock), not a generic "utils".
// Only depends on the image-URL service (image.ts); it never touches the listings cache
// or network layer, so domain logic stays off infrastructure.
import type { AdoptListing } from './types'
import { stableImageUrl } from '../data/image'

// Static race-name dictionary (mirrors Swift raceNamesMap)
const RACE_NAMES: Record<number, string> = {
  1: '狼', 2: '龙', 3: '羊', 4: '虎', 5: '狗',
  6: '熊', 7: '犬', 8: '猫', 10: '狐狸', 12: '神兽',
  13: '兵器', 14: '鱼', 15: '昆虫', 16: '豹', 17: '植物',
  18: '蛇', 19: '神话', 20: '鸟', 21: '兔', 22: '龙犬',
  23: '蝙蝠', 24: '狮', 25: '东方龙', 26: '神秘生物',
  27: '神', 28: '鹿',
}

export function raceName(listing: AdoptListing): string | undefined {
  const fromNested = listing.harmonyRace?.raceName
  if (fromNested) return fromNested
  if (listing.raceId != null) return RACE_NAMES[listing.raceId]
  return undefined
}

export function colorNames(listing: AdoptListing): string[] {
  return listing.harmonyAdoptColorVos?.map((c) => c.harmonyColor?.colorName).filter((n): n is string => !!n) ?? []
}

export function painterName(listing: AdoptListing): string | undefined {
  return listing.harmonyPainterVo?.painterName
}

export function painterAvatar(listing: AdoptListing): string | undefined {
  const url = listing.harmonyPainterVo?.avatarPhoto
  return url ? stableImageUrl(url) : undefined
}

export function displayPrice(listing: AdoptListing): number {
  return listing.nonrecurringExpense ?? 0
}

export function isAdopted(listing: AdoptListing): boolean {
  return listing.status === 1
}

export function isLocked(listing: AdoptListing): boolean {
  return listing.isLock === 2
}

// Static cached Date parsing (createTime "yyyy-MM-dd HH:mm:ss")
let cachedDateParse: ((s: string) => Date | null) | null = null
function getDateParser(): (s: string) => Date | null {
  if (cachedDateParse) return cachedDateParse
  // Manual parse avoids Date constructor locale ambiguity; also handles missing seconds
  cachedDateParse = (s) => {
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/)
    if (!m) return null
    const [, y, mo, d, h, mi, se] = m
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), se ? Number(se) : 0)
    return dt.getTime() ? dt : null
  }
  return cachedDateParse
}

export function publishDate(listing: AdoptListing): Date | null {
  if (!listing.createTime) return null
  return getDateParser()(listing.createTime)
}

export function detailImages(listing: AdoptListing): string[] {
  const fromDetails = listing.harmonyAdoptDetails?.map((d) => d.detailPicture).filter((s): s is string => !!s && s.length > 0).map((s) => stableImageUrl(s)!) ?? []
  if (fromDetails.length === 0 && listing.adoptPicture) return [stableImageUrl(listing.adoptPicture)!]
  return fromDetails
}

export function formatPrice(n: number): string {
  return `¥${Math.round(n)}`
}

export function formatDiscount(listing: AdoptListing): number {
  const all = listing.allcost ?? 0
  const non = listing.nonrecurringExpense ?? 0
  if (all > 0 && non > 0 && all !== non) {
    const d = (non / all) * 10
    if (d > 0 && d < 10) return d
  }
  return 0
}

export function isSelfCommission(listing: AdoptListing): boolean {
  return painterName(listing) === '自设委托'
}

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
export const PRICE_MODES = ['once', 'installment', 'hidden'] as const
export type PriceMode = typeof PRICE_MODES[number]

export const PRICE_MODE_LABELS: Record<PriceMode, string> = {
  once: '一口价',
  installment: '12期分期',
  hidden: '隐藏',
}

export const INSTALLMENTS = 12

/** The total across 12 periods. Without an allcost, it falls back to the pay-once
 *  price, so no discount exists. */
export function installmentTotal(listing: AdoptListing): number {
  const all = listing.allcost ?? 0
  return all > 0 ? all : displayPrice(listing)
}

/**
 * The monthly amount: (installment total − deposit) / 12, rounded up, so the page
 * never shows a figure below the real one. null when the deposit already covers the
 * total; the caller then draws nothing.
 */
export function monthlyPayment(listing: AdoptListing): number | null {
  const rest = installmentTotal(listing) - (listing.earnest ?? 0)
  return rest > 0 ? Math.ceil(rest / INSTALLMENTS) : null
}

// What we draw in a price slot. Components only lay this out.
//
// Two types, because the two modes share almost no fields: one payment has a price, a
// discount, and an original price; 12 periods have a deposit, a monthly amount, and a
// total. In one big type, a component read `down === null` as "not installment mode".

/** The one number on a waterfall card. A null label means no word before the number. */
export interface CardPrice {
  label: string | null
  value: number
}

/** One payment, settled at the discounted price. */
export interface OncePrice {
  mode: 'once'
  /** the price; the page still draws a 0, as before the modes existed */
  main: number
  /** the 12-period total, struck through next to the price; only set when discount > 0 */
  secondary: number | null
  /** the discount badge; 0 means no badge */
  discount: number
  card: CardPrice
}

/** 12 periods: a deposit plus a monthly amount. */
export interface InstallmentPrice {
  mode: 'installment'
  /** the deposit. null means the setting has no deposit, which is not the same as 0. */
  down: number | null
  /** the monthly amount; null when it cannot be worked out */
  main: number | null
  /** "月供", the word before main; null with main */
  mainLabel: string | null
  /** "×12期", the word after main; null with main */
  note: string | null
  /** the total; null with main, because a total with no monthly amount is wrong */
  total: number | null
  /** the deposit, or the monthly amount without a deposit; null when neither exists */
  card: CardPrice | null
}

export type PriceParts = OncePrice | InstallmentPrice

/** null when the mode hides prices. */
export function priceParts(listing: AdoptListing, mode: PriceMode): PriceParts | null {
  const once = displayPrice(listing)
  const discount = formatDiscount(listing)

  if (mode === 'hidden') return null
  if (mode === 'installment') {
    const down = (listing.earnest ?? 0) > 0 ? listing.earnest! : null
    const per = monthlyPayment(listing)
    return {
      mode,
      down,
      main: per,
      mainLabel: per === null ? null : '月供',
      note: per === null ? null : `×${INSTALLMENTS}期`,
      total: per === null ? null : installmentTotal(listing),
      card: down !== null ? { label: '首付', value: down }
        : per !== null ? { label: '月供', value: per } : null,
    }
  }
  // One payment draws the price as it always did, including a 0.
  return {
    mode: 'once',
    main: once,
    // secondary means "the original price", so it shares the discount's condition. Two
    // settings cost more in one payment than in 12 periods (#578: 21000 / 19680, #2832:
    // 36300 / 33800). Under `allcost > 0` they drew a number below the price with no
    // strike-through and no badge.
    secondary: discount > 0 ? listing.allcost! : null,
    discount,
    card: { label: null, value: once },
  }
}
