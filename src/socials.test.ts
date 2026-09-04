// Functional tests for the pure socials domain (socials.ts). No reactivity, no I/O.
// All data below is FAKE — never reference real owners/handles/ids from production.
import { describe, expect, it } from 'vitest'
import {
  buildUrl, displayValue, parseSocials, searchables, toSearchMap, uidPrefixes,
  type SocialEntry,
} from './socials'

const DOUYIN = { uid: '111222333', sec_uid: 'fake_sec_uid_abc' }
const XHS = { uid: '444555666', sec_uid: 'fake_xhs_sec_uid_789' }

describe('parseSocials', () => {
  it('parses a valid schema into a Map keyed by adoptId', () => {
    const out = parseSocials({
      '1063': { ownerName: 'FakeOwnerA', platforms: { x: 'FakeHandleX' } },
      '1384': { ownerName: 'FakeOwnerB', platforms: { douyin: DOUYIN } },
    })
    expect(out.size).toBe(2)
    expect(out.get(1063)?.ownerName).toBe('FakeOwnerA')
    expect(out.get(1384)?.platforms.douyin).toEqual(DOUYIN)
  })

  it('skips entries missing ownerName', () => {
    const out = parseSocials({ '1063': { platforms: { x: 'FakeHandleX' } } })
    expect(out.size).toBe(0)
  })

  it('ignores unknown platform keys', () => {
    const out = parseSocials({ '755': { ownerName: 'FakeOwnerC', platforms: { x: 'FakeHandleY', myspace: 'x' } } })
    expect(out.get(755)?.platforms).toEqual({ x: 'FakeHandleY' })
  })

  it('skips invalid uid-pair platforms (missing sec_uid)', () => {
    const out = parseSocials({ '1384': { ownerName: 'FakeOwnerB', platforms: { douyin: { uid: '111222333' } } } })
    expect(out.get(1384)?.platforms).toEqual({})
  })

  it('returns empty for non-object / null input', () => {
    expect(parseSocials(null).size).toBe(0)
    expect(parseSocials('nope').size).toBe(0)
    expect(parseSocials(42).size).toBe(0)
  })
})

describe('buildUrl', () => {
  const p = { x: 'FakeHandleX', bilibili: '999888777', tiktok: 'FakeTikTok', douyin: DOUYIN, xiaohongshu: XHS }

  it('constructs the per-platform URL', () => {
    expect(buildUrl('x', p)).toBe('https://x.com/FakeHandleX')
    expect(buildUrl('bilibili', p)).toBe('https://space.bilibili.com/999888777')
    expect(buildUrl('tiktok', p)).toBe('https://www.tiktok.com/@FakeTikTok')
    expect(buildUrl('douyin', p)).toBe('https://www.douyin.com/user/fake_sec_uid_abc')
    expect(buildUrl('xiaohongshu', p)).toBe('https://www.xiaohongshu.com/user/profile/fake_xhs_sec_uid_789')
  })

  it('returns null when the value is absent', () => {
    expect(buildUrl('x', {})).toBeNull()
    expect(buildUrl('douyin', {})).toBeNull()
  })
})

describe('displayValue', () => {
  const p = { x: 'FakeHandleX', bilibili: '999888777', tiktok: 'FakeTikTok', douyin: DOUYIN, xiaohongshu: XHS }

  it('shows @handle for x/tiktok, mid for bilibili, uid for douyin/xiaohongshu', () => {
    expect(displayValue('x', p)).toBe('@FakeHandleX')
    expect(displayValue('bilibili', p)).toBe('999888777')
    expect(displayValue('tiktok', p)).toBe('@FakeTikTok')
    expect(displayValue('douyin', p)).toBe('111222333')
    expect(displayValue('xiaohongshu', p)).toBe('444555666')
  })
})

describe('searchables & uidPrefixes', () => {
  const entry: SocialEntry = {
    ownerName: 'FakeOwnerA',
    platforms: { x: 'FakeHandleX', bilibili: '999888777', tiktok: 'FakeTikTok', douyin: DOUYIN, xiaohongshu: XHS },
  }

  it('searchables are substring values: ownerName + x/tiktok handles (no sec_uid)', () => {
    expect(searchables(entry)).toEqual(['FakeOwnerA', 'FakeHandleX', 'FakeTikTok'])
  })

  it('uidPrefixes are the numeric ids: bilibili mid + douyin.uid + xiaohongshu.uid', () => {
    expect(uidPrefixes(entry)).toEqual(['999888777', '111222333', '444555666'])
  })
})

describe('toSearchMap', () => {
  it('maps entries to SocialSearchEntry for the filter', () => {
    const entries = new Map<number, SocialEntry>([[1063, { ownerName: 'FakeOwnerA', platforms: { x: 'FakeHandleX' } }]])
    const out = toSearchMap(entries)
    expect(out.get(1063)).toEqual({ ownerName: 'FakeOwnerA', searchables: ['FakeOwnerA', 'FakeHandleX'], uidPrefixes: [] })
  })

  it('empty input → empty map', () => {
    expect(toSearchMap(new Map()).size).toBe(0)
  })
})
