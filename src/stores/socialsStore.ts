// Runtime fetch of the hand-collected accounts.
//
// They are not part of the API: `npm run socials` writes `public/socials.json`, the repository does
// not hold that file, and the app fetches it once at init. A failed load leaves the accounts empty,
// so search stops matching owner names and the detail section stays hidden.
import { createSignal } from "solid-js";
import {
  parseSocials,
  toSearchMap,
  type SocialEntry,
  type SocialSearchEntry,
} from "../data/socials";

const [socials, setSocials] = createSignal<Map<number, SocialEntry>>(new Map());
const [socialSearch, setSocialSearch] = createSignal<
  Map<number, SocialSearchEntry>
>(new Map());

export { socials, socialSearch };

export async function loadSocials(): Promise<void> {
  try {
    // BASE_URL is the configured sub-path WITHOUT a trailing slash (base: '/furmony-gallery'),
    // so add one: public/socials.json is served at <base>/socials.json.
    const base = import.meta.env.BASE_URL.replace(/\/+$/, "") + "/";
    const res = await fetch(`${base}socials.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching socials.json`);
    const data: unknown = await res.json();
    const entries = parseSocials(data);
    setSocials(entries);
    setSocialSearch(toSearchMap(entries));
  } catch (err) {
    console.error("[socials] load failed", err);
    setSocials(new Map());
    setSocialSearch(new Map());
  }
}
