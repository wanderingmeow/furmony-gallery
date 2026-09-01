import type { AdoptListing } from './types'
import { stableImageUrl } from './cache'

// Thumbnail aspect ratio (921/597) — used for card height estimation
export const THUMB_ASPECT = 921 / 597
// Estimated text/extra height below the thumbnail in a card
// Real card height = cardWidth / THUMB_ASPECT + this. Measured via Playwright WebKit
// at several widths (186/326/280px card): actual ≈ cardWidth/THUMB_ASPECT + 87.62.
// The thumbnail is inset 24px horizontally, so the old +100 over-reserved by ~12.4px,
// making the vertical card gap bigger than the horizontal 16px gap.
// Keep it exact so rowHeight - cardHeight leaves a 16px vertical gap == horizontal gap.
export const CARD_EXTRA_HEIGHT = 87.62

export type SortMode = 'timeDesc' | 'timeAsc' | 'priceAsc' | 'priceDesc'
export type FilterTab = 'all' | 'unlocked' | 'locked' | 'wishlist'

export const FILTER_TABS: FilterTab[] = ['all', 'unlocked', 'locked', 'wishlist']

export const TAB_LABELS: Record<FilterTab, string> = {
  all: '全部',
  unlocked: '未锁定',
  locked: '已锁定',
  wishlist: '心愿单',
}

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

export function isDimmed(listing: AdoptListing): boolean {
  return isAdopted(listing) || isLocked(listing)
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
