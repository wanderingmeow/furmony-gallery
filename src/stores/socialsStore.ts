// src/stores/socialsStore.ts — runtime fetch of the hand-collected socials.json.
//
// Socials are NOT part of the API; they live in `public/socials.json` (committed) and are
// fetched once at init. Failure degrades gracefully: the app still works, search just
// doesn't match owner/accounts and the detail social section stays hidden until it loads.
import { createSignal } from 'solid-js'
import { parseSocials, toSearchMap, type SocialEntry, type SocialSearchEntry } from '../socials'

const [socials, setSocials] = createSignal<Map<number, SocialEntry>>(new Map())
const [socialSearch, setSocialSearch] = createSignal<Map<number, SocialSearchEntry>>(new Map())

export { socials, socialSearch }

export async function loadSocials(): Promise<void> {
  try {
    // BASE_URL is the configured sub-path WITHOUT a trailing slash (base: '/furmony-gallery'),
    // so add one: public/socials.json is served at <base>/socials.json.
    const base = import.meta.env.BASE_URL.replace(/\/+$/, '') + '/'
    const res = await fetch(`${base}socials.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching socials.json`)
    const data: unknown = await res.json()
    const entries = parseSocials(data)
    setSocials(entries)
    setSocialSearch(toSearchMap(entries))
  } catch (err) {
    console.error('加载社交账号数据失败', err)
    setSocials(new Map())
    setSocialSearch(new Map())
  }
}
