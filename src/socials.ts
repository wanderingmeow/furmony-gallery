// Pure social-account domain (no reactivity, no I/O, no DOM) — unit-testable in isolation.
//
// Socials are hand-collected (NOT from the API), shipped as `public/socials.json` and fetched
// at runtime. This module owns the schema validation, URL construction and searchable-text
// extraction; the store/UI layers stay thin and call in here.
export type PlatformKey = 'x' | 'bilibili' | 'tiktok' | 'douyin' | 'xiaohongshu'

// Douyin & Xiaohongshu need an opaque sec_uid (used for the URL) plus a numeric uid
// (used for search). X/Bilibili/TikTok are plain strings (handle or mid).
export interface SocialPlatforms {
  x?: string
  bilibili?: string
  tiktok?: string
  douyin?: { uid: string; sec_uid: string }
  xiaohongshu?: { uid: string; sec_uid: string }
}

export interface SocialEntry {
  ownerName: string
  platforms: SocialPlatforms
}

// Slim form handed to the pure filter.
// searchables  = substring-match text (ownerName + x/tiktok handles)
// uidPrefixes  = prefix-match numeric ids (bilibili mid + douyin.uid + xiaohongshu.uid)
export interface SocialSearchEntry {
  ownerName: string
  searchables: string[]
  uidPrefixes: string[]
}

// Fixed render order for the detail-sheet chips (JSON order is irrelevant).
export const PLATFORM_ORDER: PlatformKey[] = ['x', 'tiktok', 'bilibili', 'douyin', 'xiaohongshu']

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function isUidPair(v: unknown): v is { uid: string; sec_uid: string } {
  return (
    typeof v === 'object' && v !== null &&
    isNonEmptyString((v as { uid?: unknown }).uid) &&
    isNonEmptyString((v as { sec_uid?: unknown }).sec_uid)
  )
}

// Parse `public/socials.json` into a Map<adoptId, SocialEntry>. Invalid entries are skipped;
// unknown platform keys are ignored (we only keep platforms we can render/link).
export function parseSocials(data: unknown): Map<number, SocialEntry> {
  const out = new Map<number, SocialEntry>()
  if (typeof data !== 'object' || data === null) return out

  for (const [key, raw] of Object.entries(data as Record<string, unknown>)) {
    const adoptId = Number(key)
    if (!Number.isInteger(adoptId)) continue

    const entry = raw as Record<string, unknown>
    if (typeof entry !== 'object' || entry === null) continue
    const ownerName = entry.ownerName
    if (!isNonEmptyString(ownerName)) continue

    const platforms: SocialPlatforms = {}
    const rawPlatforms = entry.platforms
    if (typeof rawPlatforms === 'object' && rawPlatforms !== null) {
      for (const [pk, pv] of Object.entries(rawPlatforms as Record<string, unknown>)) {
        if (pk === 'x' || pk === 'bilibili' || pk === 'tiktok') {
          if (isNonEmptyString(pv)) platforms[pk] = pv
        } else if (pk === 'douyin' || pk === 'xiaohongshu') {
          if (isUidPair(pv)) platforms[pk] = { uid: pv.uid, sec_uid: pv.sec_uid }
        }
        // unknown platform keys are skipped (nothing to render/link)
      }
    }

    out.set(adoptId, { ownerName, platforms })
  }
  return out
}

// Build the clickable URL for a platform (render-time). Unknown platform → null.
export function buildUrl(platform: PlatformKey, p: SocialPlatforms): string | null {
  switch (platform) {
    case 'x': return p.x ? `https://x.com/${p.x}` : null
    case 'bilibili': return p.bilibili ? `https://space.bilibili.com/${p.bilibili}` : null
    case 'tiktok': return p.tiktok ? `https://www.tiktok.com/@${p.tiktok}` : null
    case 'douyin': {
      const d = p.douyin
      return d ? `https://www.douyin.com/user/${d.sec_uid}` : null
    }
    case 'xiaohongshu': {
      const x = p.xiaohongshu
      return x ? `https://www.xiaohongshu.com/user/profile/${x.sec_uid}` : null
    }
  }
}

// The short label shown on the chip (the searchable handle/uid), e.g. "@handle" or the mid.
export function displayValue(platform: PlatformKey, p: SocialPlatforms): string {
  switch (platform) {
    case 'x': return p.x ? `@${p.x}` : ''
    case 'bilibili': return p.bilibili ?? ''
    case 'tiktok': return p.tiktok ? `@${p.tiktok}` : ''
    case 'douyin': return p.douyin?.uid ?? ''
    case 'xiaohongshu': return p.xiaohongshu?.uid ?? ''
  }
}

// Substring-match search values: ownerName + x/tiktok handles (NOT sec_uid).
export function searchables(entry: SocialEntry): string[] {
  const p = entry.platforms
  const out = [entry.ownerName]
  if (p.x) out.push(p.x)
  if (p.tiktok) out.push(p.tiktok)
  return out
}

// Prefix-match numeric ids: bilibili mid + douyin.uid + xiaohongshu.uid.
export function uidPrefixes(entry: SocialEntry): string[] {
  const p = entry.platforms
  const out: string[] = []
  if (p.bilibili) out.push(p.bilibili)
  if (p.douyin) out.push(p.douyin.uid)
  if (p.xiaohongshu) out.push(p.xiaohongshu.uid)
  return out
}

// Map<adoptId, SocialSearchEntry> for the pure filter. Empty/absent entry → not in the map.
export function toSearchMap(entries: Map<number, SocialEntry>): Map<number, SocialSearchEntry> {
  const out = new Map<number, SocialSearchEntry>()
  for (const [id, entry] of entries) {
    out.set(id, { ownerName: entry.ownerName, searchables: searchables(entry), uidPrefixes: uidPrefixes(entry) })
  }
  return out
}
